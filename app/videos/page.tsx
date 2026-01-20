'use client';

import { useState, useEffect } from 'react';

interface MediaData {
    url?: string;
    youtube_video_url?: string;
    video_url: string;
    filename: string;
    title: string;
    description?: string;
    type: 'video' | 'audio' | 'youtube';
    uploadedAt: string;
}

export default function MediaPage() {
    const [media, setMedia] = useState<MediaData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [bulkDeleting, setBulkDeleting] = useState(false);

    const fetchMedia = async () => {
        try {
            setLoading(true);
            const response = await fetch(`/api/videos?t=${Date.now()}`, {
                cache: 'no-store',
                headers: {
                    'Cache-Control': 'no-cache'
                }
            });
            const data = await response.json();

            if (response.ok) {
                setMedia(data.media || []);
                setError(null);
            } else {
                setError(data.error || 'Failed to fetch media');
            }
        } catch (err) {
            setError('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMedia();
    }, []);

    const toggleSelect = (filename: string) => {
        const next = new Set(selectedItems);
        if (next.has(filename)) {
            next.delete(filename);
        } else {
            next.add(filename);
        }
        setSelectedItems(next);
    };

    const toggleSelectAll = () => {
        if (selectedItems.size === media.length) {
            setSelectedItems(new Set());
        } else {
            setSelectedItems(new Set(media.map(m => m.filename)));
        }
    };

    const handleBulkDelete = async () => {
        if (selectedItems.size === 0) return;
        if (!confirm(`Are you sure you want to delete ${selectedItems.size} items?`)) return;

        setBulkDeleting(true);
        const errors: string[] = [];

        for (const filename of Array.from(selectedItems)) {
            try {
                const response = await fetch(`/api/videos/${filename}`, {
                    method: 'DELETE',
                });
                if (!response.ok) {
                    errors.push(`Failed to delete ${filename}`);
                }
            } catch (err) {
                errors.push(`Network error deleting ${filename}`);
            }
        }

        if (errors.length > 0) {
            alert(`Some items could not be deleted:\n${errors.join('\n')}`);
        }

        setSelectedItems(new Set());
        setBulkDeleting(false);
        fetchMedia();
    };

    const handleDeleteOne = async (filename: string) => {
        if (!confirm(`Are you sure you want to delete this item?`)) return;

        try {
            const response = await fetch(`/api/videos/${filename}`, {
                method: 'DELETE',
            });
            if (response.ok) {
                const next = new Set(selectedItems);
                next.delete(filename);
                setSelectedItems(next);
                fetchMedia();
            } else {
                const data = await response.json();
                alert(data.error || 'Failed to delete item');
            }
        } catch (err) {
            alert('Network error. Please try again.');
        }
    };

    const clearSelection = () => {
        setSelectedItems(new Set());
    };

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <h1 style={{ fontSize: '2rem', fontWeight: '600', margin: 0 }}>All Media ({media.length})</h1>
                    {selectedItems.size > 0 && (
                        <span style={{ fontSize: '1rem', color: '#6b7280' }}>
                            {selectedItems.size} selected
                        </span>
                    )}
                    {selectedItems.size > 0 && !bulkDeleting && (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                                onClick={handleBulkDelete}
                                style={{
                                    padding: '0.5rem 1rem',
                                    background: '#ef4444',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '0.875rem',
                                }}
                            >
                                Delete Selected ({selectedItems.size})
                            </button>
                            <button
                                onClick={clearSelection}
                                style={{
                                    padding: '0.5rem 1rem',
                                    background: '#4b5563',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '0.875rem',
                                }}
                            >
                                Clear Selection
                            </button>
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {media.length > 0 && (
                        <button
                            onClick={toggleSelectAll}
                            style={{
                                padding: '0.5rem 1rem',
                                background: '#10b981',
                                color: 'white',
                                border: '1px solid #d1d5db',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '0.875rem',
                            }}
                        >
                            {selectedItems.size === media.length ? 'Deselect All' : 'Select All'}
                        </button>
                    )}
                    <button
                        onClick={fetchMedia}
                        style={{
                            padding: '0.5rem 1rem',
                            background: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                        }}
                    >
                        Refresh
                    </button>
                    <a
                        href="/upload"
                        style={{
                            padding: '0.5rem 1rem',
                            background: '#10b981',
                            color: 'white',
                            textDecoration: 'none',
                            borderRadius: '4px',
                            display: 'inline-block',
                            fontSize: '0.875rem',
                        }}
                    >
                        Upload More
                    </a>
                </div>
            </div>

            {loading && (
                <div style={{ textAlign: 'center', padding: '3rem', fontSize: '1.2rem' }}>
                    Loading media...
                </div>
            )}

            {error && (
                <div
                    style={{
                        padding: '1rem',
                        background: '#fee2e2',
                        color: '#991b1b',
                        borderRadius: '4px',
                        marginBottom: '1rem',
                    }}
                >
                    {error}
                </div>
            )}

            {!loading && !error && media.length === 0 && (
                <div style={{ textAlign: 'center', padding: '3rem', fontSize: '1.2rem', color: '#6b7280' }}>
                    No media found. <a href="/upload" style={{ color: '#3b82f6' }}>Upload some media</a>
                </div>
            )}

            {!loading && media.length > 0 && (
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                        gap: '1.5rem',
                    }}
                >
                    {media.map((item, index) => (
                        <div
                            key={index}
                            style={{
                                border: selectedItems.has(item.filename) ? '2px solid #3b82f6' : '1px solid #e0e0e0',
                                borderRadius: '8px',
                                overflow: 'hidden',
                                background: 'white',
                                boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
                                position: 'relative',
                                display: 'flex',
                                flexDirection: 'column',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            <div style={{ position: 'absolute', top: '0.75rem', left: '0.75rem', zIndex: 10 }}>
                                <input
                                    type="checkbox"
                                    checked={selectedItems.has(item.filename)}
                                    onChange={() => toggleSelect(item.filename)}
                                    style={{ width: '1.25rem', height: '1.25rem', cursor: 'pointer' }}
                                />
                            </div>

                            <a
                                href={item.video_url}
                                style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
                            >
                                <div style={{
                                    position: 'relative',
                                    width: '100%',
                                    aspectRatio: '16/9',
                                    background: item.type === 'video' ? '#000' : item.type === 'youtube' ? '#000' : '#8b5cf6',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer'
                                }}>
                                    {item.type === 'youtube' ? (
                                        <img
                                            src={`/api/videos/${item.filename}?thumb=true`}
                                            alt={item.title}
                                            style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }}
                                        />
                                    ) : (
                                        <span style={{ fontSize: '3rem' }}>
                                            {item.type === 'video' ? '🎬' : '🎵'}
                                        </span>
                                    )}

                                    {item.type === 'youtube' && (
                                        <div style={{
                                            position: 'absolute',
                                            bottom: '0.5rem',
                                            left: '0.5rem',
                                            background: '#ef4444',
                                            color: 'white',
                                            padding: '2px 6px',
                                            borderRadius: '4px',
                                            fontSize: '0.75rem',
                                            fontWeight: 'bold'
                                        }}>
                                            YouTube
                                        </div>
                                    )}
                                </div>
                            </a>

                            <div style={{ padding: '1rem', flex: 1, display: 'flex', flexDirection: 'column', background: '#f8fafc' }}>
                                <h3
                                    style={{
                                        margin: '0 0 0.5rem 0',
                                        fontSize: '0.9375rem',
                                        fontWeight: '500',
                                        color: '#334155',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        display: '-webkit-box',
                                        WebkitLineClamp: 2,
                                        WebkitBoxOrient: 'vertical',
                                        lineHeight: '1.4'
                                    }}
                                    title={item.title}
                                >
                                    {item.title}
                                </h3>

                                <div style={{ marginTop: 'auto', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                    <a
                                        href={item.video_url}
                                        style={{ fontSize: '0.8125rem', color: '#3b82f6', textDecoration: 'none' }}
                                    >
                                        View Details
                                    </a>
                                    <span style={{ color: '#cbd5e1' }}>|</span>
                                    <a
                                        href={item.youtube_video_url || item.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{ fontSize: '0.8125rem', color: '#3b82f6', textDecoration: 'none' }}
                                    >
                                        Direct Link
                                    </a>
                                    <span style={{ color: '#cbd5e1' }}>|</span>
                                    <button
                                        onClick={() => handleDeleteOne(item.filename)}
                                        style={{
                                            fontSize: '0.8125rem',
                                            color: '#ef4444',
                                            textDecoration: 'underline',
                                            background: 'none',
                                            border: 'none',
                                            padding: 0,
                                            cursor: 'pointer',
                                        }}
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
