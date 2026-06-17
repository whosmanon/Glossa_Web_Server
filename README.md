# Glossa Web Server

Professional web server for translating Adobe InDesign IDML files.

## Features

✅ **Upload & Translate** — Drag & drop IDML files  
✅ **6 Languages** — French, English, Spanish, German, Dutch, Portuguese  
✅ **Real-time Progress** — See translation status live  
✅ **Instant Download** — Get translated files immediately  
✅ **Fast & Reliable** — Uses Google Translate API via MyMemory  

## Installation

### Local Development

```bash
npm install
npm run dev
```

Visit `http://localhost:3000`

### Production Deployment

#### Option 1: Heroku (Free tier available)

```bash
heroku create your-app-name
git push heroku main
heroku open
```

#### Option 2: Vercel

```bash
vercel
```

#### Option 3: Self-hosted (VPS)

```bash
npm install
NODE_ENV=production npm start
```

Configure a reverse proxy (Nginx/Apache) or use PM2:

```bash
npm install -g pm2
pm2 start server.js --name "glossa"
pm2 startup
pm2 save
```

## Environment Variables

```bash
PORT=3000  # Default port
NODE_ENV=production  # Set to 'production' in production
```

## API Endpoints

### POST `/api/translate`
Upload and translate IDML file.

**Request:**
```
FormData:
  - file: IDML file
  - fromLang: Source language (fr, en, es, de, nl, pt)
  - toLang: Target language
```

**Response:**
```json
{
  "success": true,
  "downloadId": "uuid",
  "fileName": "file_translated_EN.idml",
  "textCount": 42
}
```

### GET `/api/download/:downloadId`
Download translated file.

**Query Parameters:**
```
?fileName=file_translated_EN.idml
```

## How It Works

1. **Upload** — User uploads IDML file via drag & drop
2. **Extract** — Server extracts text from IDML ZIP structure
3. **Translate** — Each text segment is translated via MyMemory API
4. **Reinject** — Translations are reinserted into original IDML
5. **Download** — User downloads the translated file

## File Cleanup

- Original uploads: Deleted after 5 seconds
- Translated files: Deleted after 1 hour
- Downloaded files: Deleted 30 seconds after download

## Scaling Notes

For high traffic:

- Add Redis for caching translations
- Use a queue (Bull, RabbitMQ) for large batches
- Store files in S3 instead of disk
- Add rate limiting

## License

© 2026 Glossa

## Support

For issues or questions, create an issue on GitHub.
