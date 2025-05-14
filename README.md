🎬 Video Splicer App (Next.js + Shotstack)

This is a full-stack video splicing app built with Next.js, AWS S3, and Shotstack's video rendering API. It allows users to:

Upload a main video and a clip

Specify a start and end timestamp

Splice the clip into the main video at the defined interval

Automatically render and return the final video from Shotstack

🚀 Features

Drag-and-drop file upload UI with animated feedback

Uploads videos to S3

Sends a structured timeline payload to Shotstack's /render API

Polls for render status and displays a final download link

Cleans up temporary files

🛠️ Getting Started

1. Clone the Repo

git clone https://github.com/YOUR_USERNAME/video-splicer.git
cd video-splicer

2. Install Dependencies

npm install

3. Environment Variables

Create a .env.local file:

AWS_REGION=us-east-2
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_S3_BUCKET=your-bucket-name

SHOTSTACK_DEV_API_KEY=your-sandbox-api-key

✅ Do not check in .env.local to GitHub.

📁 Folder Structure

/pages
  /api
    splice-videos.ts         # Handles uploads and Shotstack integration
/lib
  s3Uploader.ts              # S3 upload and delete utilities
/styles
  globals.css                # TailwindCSS styles

🧪 Testing

Start local dev server:

npm run dev

Then open http://localhost:3000 to access the app.

✅ To Do / Optional Enhancements

Add render status page

Retry mechanism if polling fails

User auth or signed uploads

Real-time render progress bar (Shotstack webhook optional)

🛡 Security Note

This repo does not commit any credentials. Your .env.local should never be pushed. Use GitHub secrets for production deployments.

📄 License

MIT — feel free to fork, modify, and build upon it.