## Netlify

1. npm install -g netlify-cli
2. netlify login
3. netlify link
4. netlify dev    ---> to run locally
install dependency
4. npm install @netlify/blobs
5. netlify deploy --prod --dir=dist

## React
npm install
npm run dev

## docker
docker build -t marketing-engine-frontend:latest .

docker run -p 8080:8080 --name marketing-engine-frontend marketing-engine-frontend
