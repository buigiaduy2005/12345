import { useState, useEffect, useRef } from 'react';
import { message } from 'antd';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { authService } from '../services/auth';
import { API_BASE_URL } from '../services/api';
import { userService } from '../services/userService';
import { feedService } from '../services/feedService';
import type { User, Post } from '../types';
import PostCard from '../components/PostCard';
import NavigationBar from '../components/NavigationBar';
import LeftSidebar from '../components/LeftSidebar';
import FloatingChat from '../components/chat/FloatingChat';
import ChatSidebar from '../components/chat/ChatSidebar';
import { DEPARTMENTS, POST_CATEGORIES } from '../constants';
import { detectSensitiveContent } from '../utils/contentAnalyzer';
import './FeedPage.css';



export default function FeedPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const user = authService.getCurrentUser();
    const [openChats, setOpenChats] = useState<User[]>([]); // Max 3 chat windows

    // Helper function to open a chat window
    const handleOpenChat = (chatUser: User) => {
        // Check if already open
        if (openChats.some(u => u.id === chatUser.id || u.username === chatUser.username)) {
            return; // Already open
        }
        // Check max limit
        if (openChats.length >= 3) {
            message.warning('Maximum 3 chat windows allowed');
            return;
        }
        setOpenChats(prev => [...prev, chatUser]);
    };

    // Function to close a chat window
    const handleCloseChat = (chatUserId: string) => {
        setOpenChats(prev => prev.filter(u => (u.id || u.username) !== chatUserId));
    };

    // Feed State
    const [posts, setPosts] = useState<Post[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [newPostContent, setNewPostContent] = useState('');
    const [isPosting, setIsPosting] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<string>('General');
    const [allowedRoles, setAllowedRoles] = useState<string[]>([]);
    const [allowedDepartments, setAllowedDepartments] = useState<string[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Filter State
    const [filterCategory, setFilterCategory] = useState<string>('All');
    const [filterDate, setFilterDate] = useState<string>('All');

    // Highlighted Post State
    const [searchParams] = useSearchParams();
    const highlightedPostId = searchParams.get('postId');

    // Focused Post State (from notification hash)
    const [focusedPostId, setFocusedPostId] = useState<string | null>(null);

    // Sensitive Content Warning State
    const [showWarning, setShowWarning] = useState(false);
    const [warningMessage, setWarningMessage] = useState('');


    // Detect hash for focused post (from notification)
    useEffect(() => {
        const hash = location.hash.slice(1); // Remove #
        if (hash) {
            console.log('Hash detected:', hash);
            setFocusedPostId(hash);
            // Scroll to post after small delay
            setTimeout(() => {
                const element = document.getElementById(`post-${hash}`);
                if (element) {
                    console.log('Scrolling to element:', element);
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                } else {
                    console.log('Element not found:', `post-${hash}`);
                }
            }, 500);
        } else {
            setFocusedPostId(null);
        }
    }, [location.hash, posts]); // Re-run when hash or posts change

    // Initial Data Fetch
    useEffect(() => {
        if (!user) return;

        const fetchData = async () => {
            setIsLoading(true);
            try {
                const postsData = await feedService.getPosts();
                // Sort: Pinned first, then by Date descending
                const sortedPosts = postsData.posts.sort((a, b) => {
                    if (a.isPinned === b.isPinned) {
                        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                    }
                    return a.isPinned ? -1 : 1;
                });
                setPosts(sortedPosts);


            } catch (error) {
                console.error("Error loading feed data", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [user?.username, navigate]);

    // Quick Chat Effects - REMOVED history loading
    // useEffect(() => { ... })

    // Scroll effect REMOVED




    const getAvatarUrl = (userOrUrl?: any) => {
        if (!userOrUrl) return `https://i.pravatar.cc/150?u=user`;
        const url = typeof userOrUrl === 'string' ? userOrUrl : userOrUrl.avatarUrl;
        if (!url) return `https://i.pravatar.cc/150?u=${userOrUrl.username || 'user'}`;
        if (url.startsWith('http')) return url;
        return `${API_BASE_URL}${url}`;
    };

    // Feed Actions
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setSelectedFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreviewUrl(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const removeSelectedFile = () => {
        setSelectedFile(null);
        setPreviewUrl(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleCreatePost = async () => {
        if (!newPostContent.trim() && !selectedFile) return;

        // Check for sensitive content
        const analysis = detectSensitiveContent(newPostContent);
        if (analysis.isSensitive) {
            setWarningMessage(analysis.warningMessage);
            setShowWarning(true);
            return; // Don't proceed until user confirms
        }

        await performCreatePost();
    };

    const performCreatePost = async () => {
        if (!newPostContent.trim() && !selectedFile) return;
        setIsPosting(true);
        try {
            let mediaFiles: any[] = [];
            let postType = 'Text';

            if (selectedFile) {
                const uploadResult = await feedService.uploadFile(selectedFile);
                const fileType = selectedFile.type.startsWith('image/') ? 'image' :
                    selectedFile.type.startsWith('video/') ? 'video' : 'file';

                mediaFiles.push({
                    type: fileType,
                    url: `${API_BASE_URL}${uploadResult.url}`,
                    fileName: uploadResult.fileName,
                    fileSize: uploadResult.size
                });

                postType = fileType === 'image' ? 'Image' : fileType === 'video' ? 'Video' : 'File';
            } else if (newPostContent.includes('http')) {
                // Simple link detection
                postType = 'Link';
            }

            const newPost = await feedService.createPost(
                newPostContent,
                'Public',
                mediaFiles,
                selectedCategory,
                postType,
                allowedRoles,
                allowedDepartments
            );

            setPosts([newPost, ...posts]);
            setNewPostContent('');
            setSelectedCategory('General');
            removeSelectedFile();
        } catch (error) {
            console.error("Failed to create post", error);
            alert("Failed to post. Please try again.");
        } finally {
            setIsPosting(false);
        }
    };

    const handlePostUpdated = (updatedPost: Post) => {
        setPosts(prev => prev.map(p => p.id === updatedPost.id ? updatedPost : p));
    };

    const handlePostDeleted = (postId: string) => {
        setPosts(prev => prev.filter(p => p.id !== postId));
    };

    // Filter Logic
    const filteredPosts = posts.filter(post => {
        // If highlightedPostId is present, only show that specific post
        if (highlightedPostId && post.id !== highlightedPostId) {
            return false;
        }

        // Category filter
        if (filterCategory !== 'All' && post.category !== filterCategory) {
            return false;
        }

        // Date filter
        if (filterDate !== 'All') {
            const postDate = new Date(post.createdAt);
            const now = new Date();

            if (filterDate === 'Today') {
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                if (postDate < today) return false;
            } else if (filterDate === 'Week') {
                const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                if (postDate < weekAgo) return false;
            } else if (filterDate === 'Month') {
                const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                if (postDate < monthAgo) return false;
            }
        }

        return true;
    });

    return (
        <div className="flex min-h-screen w-full flex-col bg-[var(--color-bg)] text-[var(--color-text-main)]">
            {/* New Navigation Bar */}
            <NavigationBar onChatClick={() => navigate('/chat')} />

            <div className="social-layout">
                {/* Left Navigation Sidebar */}
                <LeftSidebar />

                {/* Main Feed Content */}
                <div className="feed-wrapper">
                    <div className="w-full flex flex-col gap-6">
                        {/* ── Welcome Banner ── */}
                        <div style={{
                            background: 'linear-gradient(135deg, #1e40af 0%, #2563eb 50%, #3b82f6 100%)',
                            borderRadius: 20,
                            padding: '24px 28px',
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            boxShadow: '0 6px 20px rgba(37,99,235,0.35)',
                            position: 'relative',
                            overflow: 'hidden',
                        }}>
                            {/* Background decoration */}
                            <div style={{
                                position: 'absolute', right: -30, top: -30,
                                width: 160, height: 160,
                                borderRadius: '50%',
                                background: 'rgba(255,255,255,0.08)',
                                pointerEvents: 'none',
                            }} />
                            <div style={{
                                position: 'absolute', right: 60, bottom: -50,
                                width: 120, height: 120,
                                borderRadius: '50%',
                                background: 'rgba(255,255,255,0.05)',
                                pointerEvents: 'none',
                            }} />
                            <div>
                                <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>
                                    Chào mừng trở lại, {user?.fullName || user?.username} 👋
                                </div>
                                <div style={{ fontSize: 13, opacity: 0.85 }}>
                                    Hôm nay có gì mới không? Chia sẻ với đồng nghiệp nhé!
                                </div>
                            </div>
                            <div style={{
                                background: 'rgba(255,255,255,0.2)',
                                borderRadius: 50,
                                padding: '6px 16px',
                                fontSize: 12,
                                fontWeight: 700,
                                letterSpacing: '0.05em',
                                whiteSpace: 'nowrap',
                                backdropFilter: 'blur(4px)',
                                flexShrink: 0,
                            }}>
                                {user?.department || user?.role || 'Nhân viên'}
                            </div>
                        </div>

                        {/* Create Post */}
                        <div className="bg-white rounded-2xl p-6 border border-[var(--color-border)] shadow-sm">
                            <textarea
                                className="w-full bg-slate-50 text-slate-900 rounded-xl p-4 resize-none border border-[var(--color-border)] focus:border-[var(--color-primary)] focus:outline-none transition-colors placeholder:text-slate-400"
                                placeholder={`What's on your mind, ${user?.fullName || user?.username}?`}
                                value={newPostContent}
                                onChange={(e) => setNewPostContent(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleCreatePost()}
                            />
                            <div className="flex items-center gap-4 mb-4">
                                <div className="user-avatar" style={{ backgroundImage: `url(${getAvatarUrl(user)})`, width: 40, height: 40, minWidth: 40, borderRadius: '50%', backgroundSize: 'cover' }}></div>
                                <input
                                    className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl h-12 px-6 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-[var(--color-primary)] focus:outline-none transition-all"
                                    placeholder={`What's on your mind?`}
                                    value={newPostContent}
                                    onChange={(e) => setNewPostContent(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleCreatePost()}
                                />
                                <button
                                    onClick={handleCreatePost}
                                    disabled={(!newPostContent.trim() && !selectedFile) || isPosting}
                                    className="bg-[var(--color-primary)] text-white px-6 py-2 rounded-full text-sm font-bold hover:bg-[var(--color-primary-hover)] disabled:opacity-50 transition-colors"
                                >
                                    {isPosting ? 'Posting...' : 'Post'}
                                </button>
                            </div>

                            {/* Image Preview */}
                            {previewUrl && (
                                <div className="relative mb-4 rounded-lg overflow-hidden border border-[var(--color-border)]">
                                    <img src={previewUrl} alt="Preview" className="w-full max-h-[300px] object-cover" />
                                    <button
                                        onClick={removeSelectedFile}
                                        className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1 transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-sm">close</span>
                                    </button>
                                </div>
                            )}

                            <div className="flex items-center gap-4 border-t border-[var(--color-border)] pt-3 justify-between">
                                <div className="flex items-center gap-2">
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleFileSelect}
                                        accept="image/*,video/*,application/pdf"
                                        style={{ display: 'none' }}
                                    />
                                    <button className="flex items-center gap-2 text-[var(--color-text-muted)] hover:text-white px-3 py-2 rounded-lg hover:bg-[var(--color-dark-surface-lighter)] transition-colors" onClick={() => fileInputRef.current?.click()}>
                                        <span className="material-symbols-outlined text-green-500">attach_file</span> Media
                                    </button>

                                </div>

                                {/* Visibility Selector */}
                                <div className="flex items-center gap-2">
                                    <span className="text-[var(--color-text-muted)] text-sm">To:</span>
                                    <select
                                        className="bg-slate-50 text-slate-800 text-sm border border-slate-200 rounded-lg px-2 py-2 focus:outline-none focus:border-[var(--color-primary)] max-w-[120px]"
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setAllowedRoles([]);
                                            setAllowedDepartments([]);

                                            if (val === 'Public') {
                                                // Default: All empty
                                            } else if (val === 'Managers') {
                                                setAllowedRoles(['Manager', 'Admin']);
                                            } else if (DEPARTMENTS.includes(val)) {
                                                setAllowedDepartments([val]);
                                            }
                                        }}
                                    >
                                        <option value="Public">Everyone</option>
                                        <option value="Managers">Managers Only</option>
                                        <optgroup label="Departments">
                                            {DEPARTMENTS.map(dept => (
                                                <option key={dept} value={dept}>{dept} Dept</option>
                                            ))}
                                        </optgroup>
                                    </select>
                                </div>

                                <div className="flex items-center gap-2">
                                    <span className="text-[var(--color-text-muted)] text-sm">Tag:</span>
                                    <select
                                        className="bg-slate-50 text-slate-800 text-sm border border-slate-200 rounded-lg px-2 py-2 focus:outline-none focus:border-[var(--color-primary)]"
                                        value={selectedCategory}
                                        onChange={(e) => setSelectedCategory(e.target.value)}
                                    >
                                        {POST_CATEGORIES.map(cat => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Filters */}
                        <div className="bg-white rounded-xl p-4 border border-[var(--color-border)] shadow-sm">
                            <div className="flex items-center gap-4 flex-wrap">
                                <span className="text-sm font-semibold text-slate-800">Filters:</span>

                                {/* Category Filter */}
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-[var(--color-text-muted)]">Category:</span>
                                    <select
                                        className="bg-slate-50 text-slate-800 text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-[var(--color-primary)]"
                                        value={filterCategory}
                                        onChange={(e) => setFilterCategory(e.target.value)}
                                    >
                                        <option value="All">All</option>
                                        {POST_CATEGORIES.map(cat => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Date Filter */}
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-[var(--color-text-muted)]">Date:</span>
                                    <div className="flex gap-1">
                                        {['All', 'Today', 'Week', 'Month'].map(period => (
                                            <button
                                                key={period}
                                                onClick={() => setFilterDate(period)}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterDate === period
                                                    ? 'bg-[var(--color-primary)] text-white shadow-sm'
                                                    : 'bg-slate-50 text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200'
                                                    }`}
                                            >
                                                {period}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Active Filter Count */}
                                {(filterCategory !== 'All' || filterDate !== 'All') && (
                                    <button
                                        onClick={() => {
                                            setFilterCategory('All');
                                            setFilterDate('All');
                                        }}
                                        className="text-xs text-[var(--color-primary)] hover:underline ml-auto"
                                    >
                                        Clear Filters
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Posts */}
                        {isLoading ? (
                            <div className="flex justify-center items-center py-20">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-primary)]"></div>
                            </div>
                        ) : (
                            <>
                                {/* Show "View All Posts" button when in focused mode */}
                                {focusedPostId && (
                                    <div className="mb-4 p-4 bg-[var(--color-dark-surface)] rounded-xl border border-[var(--color-border)] flex items-center justify-between">
                                        <p className="text-[var(--color-text-muted)] text-sm">
                                            Viewing single post from notification
                                        </p>
                                        <button
                                            onClick={() => {
                                                setFocusedPostId(null);
                                                window.history.pushState({}, '', '/feed');
                                            }}
                                            className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors text-sm font-medium"
                                        >
                                            View All Posts
                                        </button>
                                    </div>
                                )}

                                {(focusedPostId ? filteredPosts.filter(p => p.id === focusedPostId) : filteredPosts).map(post => (
                                    <div
                                        key={post.id}
                                        id={`post-${post.id}`}
                                        style={{
                                            border: highlightedPostId === post.id ? '3px solid #ff4d4f' : 'none',
                                            borderRadius: '8px',
                                            padding: highlightedPostId === post.id ? '8px' : '0',
                                            backgroundColor: highlightedPostId === post.id ? 'rgba(255, 77, 79, 0.05)' : 'transparent'
                                        }}
                                    >
                                        {highlightedPostId === post.id && (
                                            <div style={{
                                                backgroundColor: '#ff4d4f',
                                                color: 'white',
                                                padding: '8px 12px',
                                                borderRadius: '4px',
                                                marginBottom: '8px',
                                                fontWeight: 600,
                                                textAlign: 'center'
                                            }}>
                                                📌 Bài viết được báo cáo
                                            </div>
                                        )}
                                        <PostCard
                                            key={post.id}
                                            post={post}
                                            currentUser={user}
                                            onPostUpdated={handlePostUpdated}
                                            onPostDeleted={handlePostDeleted}
                                        />
                                    </div>
                                ))}
                            </>
                        )}
                    </div>
                </div>

                {/* Chat Sidebar - right side (Always visible like Facebook) */}
                <ChatSidebar onContactClick={handleOpenChat} />
            </div>


            {/* Sensitive Content Warning Modal */}
            {showWarning && (
                <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-[100]">
                    <div className="bg-white border-2 border-yellow-400 rounded-2xl p-6 max-w-md mx-4 shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center gap-3 mb-4">
                            <span className="material-symbols-outlined text-yellow-500 text-3xl">warning</span>
                            <h3 className="text-xl font-bold text-slate-900">Sensitive Content Detected</h3>
                        </div>
                        <p className="text-[var(--color-text-muted)] mb-4 leading-relaxed">{warningMessage}</p>
                        <p className="text-sm text-[var(--color-text-muted)] mb-6">Do you want to continue posting anyway?</p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setShowWarning(false);
                                    setWarningMessage('');
                                }}
                                className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors border border-slate-200"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    setShowWarning(false);
                                    setWarningMessage('');
                                    performCreatePost();
                                }}
                                className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors font-semibold"
                            >
                                Post Anyway
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Floating Chat Windows - Render up to 3 */}
            {openChats.map((chatUser, index) => (
                <FloatingChat
                    key={chatUser.id || chatUser.username}
                    chatUser={chatUser}
                    windowIndex={index}
                    onClose={() => handleCloseChat(chatUser.id || chatUser.username)}
                />
            ))}
        </div>
    );
}
