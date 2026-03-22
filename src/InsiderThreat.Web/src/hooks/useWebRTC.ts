import { useCallback, useEffect, useRef, useState } from 'react';
import { videoSignalRService } from '../services/videoSignalR';
import type * as signalR from '@microsoft/signalr';

const ICE_SERVERS: RTCConfiguration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
    ]
};

export interface PeerState {
    connectionId: string;
    displayName: string;
    peerConnection: RTCPeerConnection;
    remoteStream: MediaStream;
}

export function useWebRTC() {
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [displayStream, setDisplayStream] = useState<MediaStream | null>(null);
    const [peers, setPeers] = useState<Map<string, PeerState>>(new Map());
    const [roomCode, setRoomCode] = useState<string | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [isAudioEnabled, setIsAudioEnabled] = useState(true);
    const [isVideoEnabled, setIsVideoEnabled] = useState(true);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [peerUpdateCounter, setPeerUpdateCounter] = useState(0); // Force re-render trigger

    const connectionRef = useRef<signalR.HubConnection | null>(null);
    const peersRef = useRef<Map<string, PeerState>>(new Map());
    const localStreamRef = useRef<MediaStream | null>(null);
    const screenStreamRef = useRef<MediaStream | null>(null);
    const cameraTrackRef = useRef<MediaStreamTrack | null>(null);
    const iceCandidateQueue = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());

    // Force React to re-render by incrementing counter AND creating new Map
    const updatePeers = useCallback(() => {
        // Create new PeerState objects so React detects prop changes in children
        const newMap = new Map<string, PeerState>();
        peersRef.current.forEach((peer, key) => {
            newMap.set(key, { ...peer }); // Shallow copy each peer
        });
        setPeers(newMap);
        setPeerUpdateCounter(c => c + 1);
    }, []);

    const createPeerConnection = useCallback((targetConnectionId: string, displayName: string): RTCPeerConnection => {
        // Close existing connection if any
        const existing = peersRef.current.get(targetConnectionId);
        if (existing) {
            existing.peerConnection.close();
        }

        const pc = new RTCPeerConnection(ICE_SERVERS);

        // Add local tracks to peer connection
        const stream = localStreamRef.current;
        if (stream) {
            stream.getTracks().forEach(track => {
                console.log('[WebRTC] Adding local track:', track.kind, track.label, 'enabled:', track.enabled, 'readyState:', track.readyState);
                pc.addTrack(track, stream);
            });
        } else {
            console.warn('[WebRTC] No local stream when creating peer connection!');
        }

        // Handle ICE candidates
        pc.onicecandidate = (event) => {
            if (event.candidate && connectionRef.current) {
                connectionRef.current.invoke('SendIceCandidate', targetConnectionId, JSON.stringify(event.candidate))
                    .catch(err => console.error('[WebRTC] Failed to send ICE candidate:', err));
            }
        };

        // Handle remote tracks - USE event.streams[0] when available (browser-managed)
        pc.ontrack = (event) => {
            console.log('[WebRTC] ontrack fired:', event.track.kind, 'readyState:', event.track.readyState, 'from:', targetConnectionId);
            console.log('[WebRTC] event.streams:', event.streams.length);

            const peer = peersRef.current.get(targetConnectionId);
            if (!peer) {
                console.warn('[WebRTC] ontrack: peer not found in map for', targetConnectionId);
                return;
            }

            // Use the browser-provided stream if available (most reliable)
            let updatedStream: MediaStream;
            if (event.streams && event.streams[0]) {
                updatedStream = event.streams[0];
                console.log('[WebRTC] Using event.streams[0], tracks:', updatedStream.getTracks().map(t => `${t.kind}:${t.readyState}`));
            } else {
                // Fallback: manually manage stream
                updatedStream = peer.remoteStream;
                // Remove existing track of same kind
                updatedStream.getTracks().forEach(t => {
                    if (t.kind === event.track.kind && t.id !== event.track.id) {
                        updatedStream.removeTrack(t);
                    }
                });
                updatedStream.addTrack(event.track);
                // Create new reference to force React update
                updatedStream = new MediaStream(updatedStream.getTracks());
            }

            peer.remoteStream = updatedStream;
            updatePeers();
        };

        pc.oniceconnectionstatechange = () => {
            console.log('[WebRTC] ICE state:', targetConnectionId, pc.iceConnectionState);
            if (pc.iceConnectionState === 'failed') {
                pc.restartIce();
            }
            if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
                console.log('[WebRTC] Peer connected successfully:', targetConnectionId);
                // Force update to ensure video is displayed
                updatePeers();
            }
            if (pc.iceConnectionState === 'disconnected') {
                setTimeout(() => {
                    if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
                        removePeer(targetConnectionId);
                    }
                }, 5000);
            }
        };

        pc.onconnectionstatechange = () => {
            console.log('[WebRTC] Connection state:', targetConnectionId, pc.connectionState);
        };

        const peerState: PeerState = {
            connectionId: targetConnectionId,
            displayName,
            peerConnection: pc,
            remoteStream: new MediaStream()
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
            iceCandidateQueue.current.delete(connectionId);
            updatePeers();
        }
    }, [updatePeers]);

    const flushIceCandidates = useCallback(async (connectionId: string, pc: RTCPeerConnection) => {
        const queued = iceCandidateQueue.current.get(connectionId);
        if (queued && queued.length > 0) {
            console.log(`[WebRTC] Flushing ${queued.length} queued ICE candidates for:`, connectionId);
            for (const candidate of queued) {
                try {
                    await pc.addIceCandidate(new RTCIceCandidate(candidate));
                } catch (err) {
                    console.error('[WebRTC] Error adding queued ICE candidate:', err);
                }
            }
            iceCandidateQueue.current.delete(connectionId);
        }
    }, []);

    const setupSignalRHandlers = useCallback((conn: signalR.HubConnection) => {
        conn.off('UserJoined');
        conn.off('ReceiveOffer');
        conn.off('ReceiveAnswer');
        conn.off('ReceiveIceCandidate');
        conn.off('UserLeft');

        conn.on('UserJoined', (participant: { connectionId: string; displayName: string }) => {
            console.log('[SignalR] UserJoined:', participant.displayName, participant.connectionId);
        });

        conn.on('ReceiveOffer', async (senderConnectionId: string, sdp: string, displayName: string) => {
            console.log('[SignalR] ReceiveOffer from:', displayName, senderConnectionId);
            try {
                const pc = createPeerConnection(senderConnectionId, displayName);
                const offer = JSON.parse(sdp);
                await pc.setRemoteDescription(new RTCSessionDescription(offer));
                await flushIceCandidates(senderConnectionId, pc);
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                await conn.invoke('SendAnswer', senderConnectionId, JSON.stringify(pc.localDescription));
                console.log('[SignalR] Sent answer to:', senderConnectionId);
            } catch (err) {
                console.error('[WebRTC] Error handling offer:', err);
            }
        });

        conn.on('ReceiveAnswer', async (senderConnectionId: string, sdp: string) => {
            console.log('[SignalR] ReceiveAnswer from:', senderConnectionId);
            try {
                const peer = peersRef.current.get(senderConnectionId);
                if (peer && peer.peerConnection.signalingState === 'have-local-offer') {
                    await peer.peerConnection.setRemoteDescription(new RTCSessionDescription(JSON.parse(sdp)));
                    await flushIceCandidates(senderConnectionId, peer.peerConnection);
                }
            } catch (err) {
                console.error('[WebRTC] Error handling answer:', err);
            }
        });

        conn.on('ReceiveIceCandidate', async (senderConnectionId: string, candidate: string) => {
            try {
                const parsed = JSON.parse(candidate);
                const peer = peersRef.current.get(senderConnectionId);
                if (peer && peer.peerConnection.remoteDescription) {
                    await peer.peerConnection.addIceCandidate(new RTCIceCandidate(parsed));
                } else {
                    console.log('[WebRTC] Queuing ICE candidate for:', senderConnectionId);
                    if (!iceCandidateQueue.current.has(senderConnectionId)) {
                        iceCandidateQueue.current.set(senderConnectionId, []);
                    }
                    iceCandidateQueue.current.get(senderConnectionId)!.push(parsed);
                }
            } catch (err) {
                console.error('[WebRTC] Error adding ICE candidate:', err);
            }
        });

        conn.on('UserLeft', (connectionId: string) => {
            console.log('[SignalR] UserLeft:', connectionId);
            removePeer(connectionId);
        });
    }, [createPeerConnection, removePeer, flushIceCandidates]);

    const getMediaStream = useCallback(async (): Promise<MediaStream> => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24 } },
                audio: { echoCancellation: true, noiseSuppression: true }
            });
            cameraTrackRef.current = stream.getVideoTracks()[0] || null;
            console.log('[WebRTC] Got media stream, tracks:', stream.getTracks().map(t => `${t.kind}:${t.readyState}:${t.label}`));
            return stream;
        } catch (err) {
            console.warn('[WebRTC] Camera+Audio failed:', err);
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
                return stream;
            } catch (err2) {
                console.error('[WebRTC] All media failed:', err2);
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
        setDisplayStream(stream);

        const conn = await connectSignalR();
        const code = await conn.invoke<string>('CreateRoom');
        setRoomCode(code);
        console.log('[WebRTC] Room created:', code);
        return code;
    }, [getMediaStream, connectSignalR]);

    const joinRoom = useCallback(async (code: string): Promise<void> => {
        const stream = await getMediaStream();
        localStreamRef.current = stream;
        setLocalStream(stream);
        setDisplayStream(stream);

        const conn = await connectSignalR();

        const existingParticipants = await conn.invoke<Array<{ connectionId: string; displayName: string }>>('JoinRoom', code);
        setRoomCode(code);
        console.log('[WebRTC] Joined room:', code, 'Existing participants:', existingParticipants.length);

        // Small delay to ensure SignalR handlers are fully set up
        await new Promise(resolve => setTimeout(resolve, 100));

        for (const participant of existingParticipants) {
            try {
                const pc = createPeerConnection(participant.connectionId, participant.displayName);
                const offer = await pc.createOffer({
                    offerToReceiveAudio: true,
                    offerToReceiveVideo: true,
                });
                await pc.setLocalDescription(offer);
                await conn.invoke('SendOffer', participant.connectionId, JSON.stringify(pc.localDescription));
                console.log('[WebRTC] Sent offer to:', participant.displayName);
            } catch (err) {
                console.error('[WebRTC] Error creating offer for', participant.displayName, err);
            }
        }
    }, [getMediaStream, connectSignalR, createPeerConnection]);

    const leaveRoom = useCallback(() => {
        peersRef.current.forEach(peer => peer.peerConnection.close());
        peersRef.current.clear();
        iceCandidateQueue.current.clear();
        updatePeers();

        localStreamRef.current?.getTracks().forEach(t => t.stop());
        screenStreamRef.current?.getTracks().forEach(t => t.stop());
        localStreamRef.current = null;
        screenStreamRef.current = null;
        cameraTrackRef.current = null;
        setLocalStream(null);
        setDisplayStream(null);

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
            screenStreamRef.current?.getTracks().forEach(t => t.stop());
            screenStreamRef.current = null;

            const cameraTrack = cameraTrackRef.current;
            if (cameraTrack) {
                const replacePromises: Promise<void>[] = [];
                peersRef.current.forEach(peer => {
                    const sender = peer.peerConnection.getSenders().find(s => s.track?.kind === 'video');
                    if (sender) {
                        replacePromises.push(sender.replaceTrack(cameraTrack));
                    }
                });
                await Promise.all(replacePromises).catch(err =>
                    console.error('[WebRTC] Error replacing track back to camera:', err)
                );
            }

            setDisplayStream(localStreamRef.current);
            setIsScreenSharing(false);
        } else {
            try {
                const screenStream = await navigator.mediaDevices.getDisplayMedia({
                    video: { cursor: 'always' } as any,
                    audio: false
                });
                screenStreamRef.current = screenStream;
                const screenTrack = screenStream.getVideoTracks()[0];

                const replacePromises: Promise<void>[] = [];
                peersRef.current.forEach(peer => {
                    const sender = peer.peerConnection.getSenders().find(s => s.track?.kind === 'video');
                    if (sender) {
                        replacePromises.push(sender.replaceTrack(screenTrack));
                    }
                });
                await Promise.all(replacePromises).catch(err =>
                    console.error('[WebRTC] Error replacing track to screen:', err)
                );

                setDisplayStream(screenStream);
                setIsScreenSharing(true);

                screenTrack.onended = () => {
                    const camTrack = cameraTrackRef.current;
                    if (camTrack) {
                        peersRef.current.forEach(peer => {
                            const sender = peer.peerConnection.getSenders().find(s => s.track?.kind === 'video');
                            if (sender) sender.replaceTrack(camTrack).catch(() => { });
                        });
                    }
                    screenStreamRef.current = null;
                    setDisplayStream(localStreamRef.current);
                    setIsScreenSharing(false);
                };
            } catch {
                console.log('[WebRTC] Screen share cancelled by user');
            }
        }
    }, [isScreenSharing]);

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
        localStream: displayStream,
        peers,
        roomCode,
        isConnected,
        isAudioEnabled,
        isVideoEnabled,
        isScreenSharing,
        peerUpdateCounter, // Expose for RemoteVideo key
        createRoom,
        joinRoom,
        leaveRoom,
        toggleAudio,
        toggleVideo,
        toggleScreenShare,
    };
}
