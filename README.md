# Media API (Video & Audio)

A full-featured Media Upload and Player application built with Next.js. Supports all video formats and MP3 files.

## Features
- **Broad Format Support**: MP4, WebM, MKV, AVI, MOV, MP3, WAV, etc.
- **Large File Support**: Upload files up to 100MB.
- **Unified Media Player**: Play both video and audio files in a custom player.
- **Dual Storage**: Local and Vercel Blob storage support.
- **Clean UI**: Responsive gallery and intuitive upload interface.

## Quick Start
1. `cd Video_API`
2. `npm install`
3. `npm run dev`
4. Visit `http://localhost:3001`

## API Endpoints
- `POST /api/upload` - Upload media (use field name `media`)
- `GET /api/videos` - Get all media files
- `GET /api/videos/[filename]` - Serve raw media
- `GET /api/videos/[filename]/info` - Get media metadata
