import { useCallback, useEffect, useRef, useState } from 'react';
import { videoSignalRService } from '../services/videoSignalR';
import type * as signalR from '@microsoft/signalr';

const ICE_SERVERS: RTCConfiguration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ]
};

interface PeerState {
    connectionId: string;
    displayName: string;
    peerConnection: RTCPeerConnection;
    remoteStream: MediaStream;
}

interface UseWebRTCReturn {
    localStream: MediaStream | null;
    peers: Map<string, PeerState>;
    roomCode: string | null;
    isConnected: boolean;
    isAudioEnabled: boolean;
    isVideoEnabled: boolean;
    isScreenSharing: boolean;
    createRoom: () => Promise<string>;
    joinRoom: (code: string) => Promise<void>;
    leaveRoom: () => void;
    toggleAudio: () => void;
    toggleVideo: () => void;
    toggleScreenShare: () => Promise<void>;
}

export function useWebRTC(): UseWebRTCReturn {
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [peers, setPeers] = useState<Map<string, PeerState>>(new Map());
    const [roomCode, setRoomCode] = useState<string | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [isAudioEnabled, setIsAudioEnabled] = useState(true);
    const [isVideoEnabled, setIsVideoEnabled] = useState(true);
    const [isScreenSharing, setIsScreenSharing] = useState(false);

    const connectionRef = useRef<signalR.HubConnection | null>(null);
    const peersRef = useRef<Map<string, PeerState>>(new Map());
    const localStreamRef = useRef<MediaStream | null>(null);
    const screenStreamRef = useRef<MediaStream | null>(null);

    const updatePeers = useCallback(() => {
        setPeers(new Map(peersRef.current));
    }, []);

    const createPeerConnection = useCallback((targetConnectionId: string, displayName: string): RTCPeerConnection => {
        const pc = new RTCPeerConnection(ICE_SERVERS);
        const remoteStream = new MediaStream();

        // Add local tracks to peer connection
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => {
                pc.addTrack(track, localStreamRef.current!);
            });
        }

        // Handle ICE candidates
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                connectionRef.current?.invoke('SendIceCandidate', targetConnectionId, JSON.stringify(event.candidate));
            }
        };

        // Handle remote tracks
        pc.ontrack = (event) => {
            event.streams[0]?.getTracks().forEach(track => {
                remoteStream.addTrack(track);
            });
            // Update state to trigger re-render
            const peer = peersRef.current.get(targetConnectionId);
            if (peer) {
                peer.remoteStream = remoteStream;
                updatePeers();
            }
        };

        pc.oniceconnectionstatechange = () => {
            if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
                removePeer(targetConnectionId);
            }
        };

        const peerState: PeerState = {
            connectionId: targetConnectionId,
            displayName,
            peerConnection: pc,
            remoteStream
        };

        peersRef.current.set(targetConnectionId, peerState);
        updatePeers();

        return pc;
    }, [updatePeers]);

    const removePeer = useCallback((connectionId: string) => {
        const peer = peersRef.current.get(connectionId);
        if (peer) {
            peer.peerConnection.close();
            peersRef.current.delete(connectionId);
            updatePeers();
        }
    }, [updatePeers]);

    const setupSignalRHandlers = useCallback((conn: signalR.HubConnection) => {
        // When a new user joins the room - existing users receive this
        conn.on('UserJoined', async (participant: { connectionId: string; displayName: string }) => {
            // Don't create offer - wait for the new user to send offers to us
            // The new user will create offers to all existing participants
        });

        // Receive an offer from the new peer
        conn.on('ReceiveOffer', async (senderConnectionId: string, sdp: string, displayName: string) => {
            const pc = createPeerConnection(senderConnectionId, displayName);
            await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(sdp)));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await conn.invoke('SendAnswer', senderConnectionId, JSON.stringify(answer));
        });

        // Receive answer from existing peer
        conn.on('ReceiveAnswer', async (senderConnectionId: string, sdp: string) => {
            const peer = peersRef.current.get(senderConnectionId);
            if (peer) {
                await peer.peerConnection.setRemoteDescription(new RTCSessionDescription(JSON.parse(sdp)));
            }
        });

        // Receive ICE candidate
        conn.on('ReceiveIceCandidate', async (senderConnectionId: string, candidate: string) => {
            const peer = peersRef.current.get(senderConnectionId);
            if (peer) {
                await peer.peerConnection.addIceCandidate(new RTCIceCandidate(JSON.parse(candidate)));
            }
        });

        // When a user leaves
        conn.on('UserLeft', (connectionId: string) => {
            removePeer(connectionId);
        });
    }, [createPeerConnection, removePeer]);

    const getMediaStream = useCallback(async (): Promise<MediaStream> => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            return stream;
        } catch {
            // Try audio only if video fails
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
                return stream;
            } catch {
                // Return empty stream if both fail
                return new MediaStream();
            }
        }
    }, []);

    const connectSignalR = useCallback(async (): Promise<signalR.HubConnection> => {
        const token = localStorage.getItem('token') || '';
        const conn = await videoSignalRService.connect(token);
        connectionRef.current = conn;
        setupSignalRHandlers(conn);
        setIsConnected(true);
        return conn;
    }, [setupSignalRHandlers]);

    const createRoom = useCallback(async (): Promise<string> => {
        const stream = await getMediaStream();
        localStreamRef.current = stream;
        setLocalStream(stream);

        const conn = await connectSignalR();
        const code = await conn.invoke<string>('CreateRoom');
        setRoomCode(code);
        return code;
    }, [getMediaStream, connectSignalR]);

    const joinRoom = useCallback(async (code: string): Promise<void> => {
        const stream = await getMediaStream();
        localStreamRef.current = stream;
        setLocalStream(stream);

        const conn = await connectSignalR();

        // JoinRoom returns existing participants
        const existingParticipants = await conn.invoke<Array<{ connectionId: string; displayName: string }>>('JoinRoom', code);
        setRoomCode(code);

        // Create offers to all existing participants (new user initiates)
        for (const participant of existingParticipants) {
            const pc = createPeerConnection(participant.connectionId, participant.displayName);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            await conn.invoke('SendOffer', participant.connectionId, JSON.stringify(offer));
        }
    }, [getMediaStream, connectSignalR, createPeerConnection]);

    const leaveRoom = useCallback(() => {
        // Close all peer connections
        peersRef.current.forEach(peer => {
            peer.peerConnection.close();
        });
        peersRef.current.clear();
        updatePeers();

        // Stop all local tracks
        localStreamRef.current?.getTracks().forEach(t => t.stop());
        screenStreamRef.current?.getTracks().forEach(t => t.stop());
        localStreamRef.current = null;
        screenStreamRef.current = null;
        setLocalStream(null);

        // Notify server and disconnect
        connectionRef.current?.invoke('LeaveRoom').catch(() => { });
        videoSignalRService.disconnect();
        connectionRef.current = null;

        setRoomCode(null);
        setIsConnected(false);
        setIsAudioEnabled(true);
        setIsVideoEnabled(true);
        setIsScreenSharing(false);
    }, [updatePeers]);

    const toggleAudio = useCallback(() => {
        if (localStreamRef.current) {
            const audioTrack = localStreamRef.current.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsAudioEnabled(audioTrack.enabled);
            }
        }
    }, []);

    const toggleVideo = useCallback(() => {
        if (localStreamRef.current) {
            const videoTrack = localStreamRef.current.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                setIsVideoEnabled(videoTrack.enabled);
            }
        }
    }, []);

    const toggleScreenShare = useCallback(async () => {
        if (isScreenSharing) {
            // Stop screen sharing, switch back to camera
            screenStreamRef.current?.getTracks().forEach(t => t.stop());
            screenStreamRef.current = null;

            const cameraTrack = localStreamRef.current?.getVideoTracks()[0];
            if (cameraTrack) {
                peersRef.current.forEach(peer => {
                    const sender = peer.peerConnection.getSenders().find(s => s.track?.kind === 'video');
                    sender?.replaceTrack(cameraTrack);
                });
            }
            setIsScreenSharing(false);
        } else {
            // Start screen sharing
            try {
                const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
                screenStreamRef.current = screenStream;
                const screenTrack = screenStream.getVideoTracks()[0];

                peersRef.current.forEach(peer => {
                    const sender = peer.peerConnection.getSenders().find(s => s.track?.kind === 'video');
                    sender?.replaceTrack(screenTrack);
                });

                // When user stops sharing via browser UI
                screenTrack.onended = () => {
                    const cameraTrack = localStreamRef.current?.getVideoTracks()[0];
                    if (cameraTrack) {
                        peersRef.current.forEach(peer => {
                            const sender = peer.peerConnection.getSenders().find(s => s.track?.kind === 'video');
                            sender?.replaceTrack(cameraTrack);
                        });
                    }
                    screenStreamRef.current = null;
                    setIsScreenSharing(false);
                };

                setIsScreenSharing(true);
            } catch {
                // User cancelled screen share picker
            }
        }
    }, [isScreenSharing]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            peersRef.current.forEach(peer => peer.peerConnection.close());
            peersRef.current.clear();
            localStreamRef.current?.getTracks().forEach(t => t.stop());
            screenStreamRef.current?.getTracks().forEach(t => t.stop());
            videoSignalRService.disconnect();
        };
    }, []);

    return {
        localStream,
        peers,
        roomCode,
        isConnected,
        isAudioEnabled,
        isVideoEnabled,
        isScreenSharing,
        createRoom,
        joinRoom,
        leaveRoom,
        toggleAudio,
        toggleVideo,
        toggleScreenShare,
    };
}
