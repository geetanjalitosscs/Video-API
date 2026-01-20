'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface MediaInfo {
    filename: string;
    url?: string;
    youtube_video_url?: string;
    video_url: string;
    apiUrl: string;
    title: string;
    description?: string;
    type: 'video' | 'audio' | 'youtube';
    uploadedAt: string | null;
    size: number | null;
}

export default function VideoViewPage() {
    const params = useParams();
    const router = useRouter();
    const filename = params.filename as string;
    const [info, setInfo] = useState<MediaInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [allMedia, setAllMedia] = useState<string[]>([]);
    const [currentIndex, setCurrentIndex] = useState(-1);

    useEffect(() => {
        const fetchMediaData = async () => {
            try {
                setLoading(true);
                const response = await fetch('/api/videos');
                const data = await response.json();

                if (response.ok) {
                    const media = data.media || [];
                    setAllMedia(media.map((m: any) => m.filename));

                    const matchedMedia = media.find((m: any) => m.filename === filename);

                    if (!matchedMedia) {
                        setError('Media not found');
                        return;
                    }

                    const index = media.findIndex((m: any) => m.filename === matchedMedia.filename);
                    setCurrentIndex(index);
                    setInfo({
                        filename: matchedMedia.filename,
                        url: matchedMedia.url,
                        youtube_video_url: matchedMedia.youtube_video_url,
                        video_url: matchedMedia.video_url,
                        apiUrl: `/api/videos/${matchedMedia.filename}`,
                        title: matchedMedia.title,
                        description: matchedMedia.description,
                        type: matchedMedia.type,
                        uploadedAt: matchedMedia.uploadedAt || null,
                        size: matchedMedia.size || null,
                    });
                    setError(null);
                } else {
                    setError(data.error || 'Failed to fetch media data');
                }
            } catch (err) {
                setError('Network error. Please try again.');
            } finally {
                setLoading(false);
            }
        };

        if (filename) {
            fetchMediaData();
        }
    }, [filename]);

    const navigateMedia = (direction: 'prev' | 'next') => {
        if (allMedia.length === 0 || currentIndex === -1) return;

        let newIndex: number;
        if (direction === 'prev') {
            newIndex = currentIndex === 0 ? allMedia.length - 1 : currentIndex - 1;
        } else {
            newIndex = currentIndex === allMedia.length - 1 ? 0 : currentIndex + 1;
        }

        router.push(`/videos/${allMedia[newIndex]}`);
    };

    if (loading) {
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100vh',
                fontSize: '1.2rem'
            }}>
                Loading media...
            </div>
        );
    }

    if (error || !info) {
        return (
            <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem' }}>
                <div
                    style={{
                        padding: '1rem',
                        background: '#fee2e2',
                        color: '#991b1b',
                        borderRadius: '4px',
                        marginBottom: '1rem',
                    }}
                >
                    {error || 'Media not found'}
                </div>
                <a
                    href="/videos"
                    style={{
                        padding: '0.5rem 1rem',
                        background: '#3b82f6',
                        color: 'white',
                        textDecoration: 'none',
                        borderRadius: '4px',
                    }}
                >
                    Back to Gallery
                </a>
            </div>
        );
    }

    const getYouTubeEmbedUrl = (url: string) => {
        if (!url) return '';
        let videoId = '';
        if (url.includes('youtube.com/shorts/')) {
            videoId = url.split('youtube.com/shorts/')[1].split('?')[0];
        } else if (url.includes('youtube.com/watch?v=')) {
            videoId = url.split('v=')[1].split('&')[0];
        } else if (url.includes('youtu.be/')) {
            videoId = url.split('youtu.be/')[1].split('?')[0];
        }
        return videoId ? `https://www.youtube.com/embed/${videoId}` : url;
    };

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
            <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <a
                    href="/videos"
                    style={{
                        padding: '0.5rem 1rem',
                        background: '#6b7280',
                        color: 'white',
                        textDecoration: 'none',
                        borderRadius: '4px',
                        fontSize: '0.875rem',
                    }}
                >
                    ← Back to Gallery
                </a>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    {allMedia.length > 1 && (
                        <>
                            <button
                                onClick={() => navigateMedia('prev')}
                                style={{
                                    padding: '0.5rem 1rem',
                                    background: '#3b82f6',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                }}
                            >
                                ← Previous
                            </button>
                            <span style={{ fontSize: '0.875rem', color: '#6b7280', fontWeight: '500' }}>
                                {currentIndex + 1} / {allMedia.length}
                            </span>
                            <button
                                onClick={() => navigateMedia('next')}
                                style={{
                                    padding: '0.5rem 1rem',
                                    background: '#3b82f6',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                }}
                            >
                                Next →
                            </button>
                        </>
                    )}
                </div>
            </div>

            <div
                style={{
                    background: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                }}
            >
                <div style={{ padding: '1.5rem', background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: '700', margin: 0, color: '#111827' }}>
                        {info.title}
                    </h2>
                    {info.description && (
                        <p style={{ marginTop: '0.5rem', color: '#4b5563', fontSize: '1rem' }}>
                            {info.description}
                        </p>
                    )}
                </div>

                <div style={{ padding: '2rem', textAlign: 'center', background: '#000', minHeight: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {info.type === 'youtube' ? (
                        <iframe
                            width="100%"
                            height="500"
                            src={getYouTubeEmbedUrl(info.youtube_video_url || '')}
                            title={info.title}
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowFullScreen
                            style={{ borderRadius: '8px', maxWidth: '900px', border: 'none' }}
                        ></iframe>
                    ) : info.type === 'audio' ? (
                        <div style={{ padding: '3rem', background: '#1f2937', borderRadius: '12px', width: '100%', maxWidth: '600px' }}>
                            <div style={{ fontSize: '4rem', marginBottom: '1.5rem' }}>🎵</div>
                            <audio controls src={info.url} style={{ width: '100%' }} />
                        </div>
                    ) : (
                        <video
                            controls
                            src={info.url}
                            style={{
                                maxWidth: '100%',
                                height: 'auto',
                                maxHeight: '70vh',
                                borderRadius: '8px',
                                boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
                            }}
                        />
                    )}
                </div>

                <div style={{ padding: '2rem', background: 'white' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) minmax(300px, 1.5fr)', gap: '3rem' }}>
                        {/* Left Column: Media Details */}
                        <div>
                            <h3 style={{ fontSize: '1.125rem', fontWeight: '700', marginBottom: '1.5rem', color: '#111827' }}>
                                Media Details
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', alignItems: 'baseline' }}>
                                    <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Type:</span>
                                    <span style={{ fontSize: '1rem', fontWeight: '500', textTransform: 'capitalize', color: '#374151' }}>{info.type}</span>
                                </div>
                                {info.size && (
                                    <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', alignItems: 'baseline' }}>
                                        <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Size:</span>
                                        <span style={{ fontSize: '1rem', fontWeight: '500', color: '#374151' }}>{(info.size / (1024 * 1024)).toFixed(2)} MB</span>
                                    </div>
                                )}
                                <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', alignItems: 'baseline' }}>
                                    <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Uploaded:</span>
                                    <span style={{ fontSize: '1rem', fontWeight: '500', color: '#374151' }}>
                                        {info.uploadedAt ? new Date(info.uploadedAt).toLocaleString() : 'N/A'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Right Column: API Information */}
                        <div style={{ background: '#f9fafb', padding: '1.5rem', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
                            <h3 style={{ fontSize: '1.125rem', fontWeight: '700', marginBottom: '1.5rem', color: '#111827' }}>
                                API Information
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                <div>
                                    <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#4b5563', display: 'block', marginBottom: '0.5rem' }}>
                                        {info.type === 'youtube' ? 'YouTube URL:' : 'API URL:'}
                                    </span>
                                    <div style={{
                                        fontSize: '0.9375rem',
                                        background: 'white',
                                        padding: '0.75rem',
                                        borderRadius: '6px',
                                        border: '1px solid #d1d5db',
                                        color: '#374151',
                                        wordBreak: 'break-all',
                                        fontFamily: 'monospace'
                                    }}>
                                        {info.type === 'youtube' ? (info.youtube_video_url || info.url) : info.apiUrl}
                                    </div>
                                </div>
                                <div>
                                    <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#4b5563', display: 'block', marginBottom: '0.5rem' }}>Filename:</span>
                                    <div style={{
                                        fontSize: '0.9375rem',
                                        background: 'white',
                                        padding: '0.75rem',
                                        borderRadius: '6px',
                                        border: '1px solid #d1d5db',
                                        color: '#374151',
                                        wordBreak: 'break-all',
                                        fontFamily: 'monospace'
                                    }}>
                                        {info.filename}
                                    </div>
                                </div>
                                <div style={{ marginTop: '0.5rem' }}>
                                    <a
                                        href={info.type === 'youtube' ? (info.youtube_video_url || info.url) : info.apiUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{
                                            display: 'inline-block',
                                            padding: '0.75rem 1.5rem',
                                            background: '#10b981',
                                            color: 'white',
                                            textDecoration: 'none',
                                            borderRadius: '6px',
                                            fontSize: '0.9375rem',
                                            fontWeight: '600',
                                            transition: 'background 0.2s'
                                        }}
                                    >
                                        {info.type === 'youtube' ? 'Open on YouTube' : 'Open Video in New Tab'}
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
