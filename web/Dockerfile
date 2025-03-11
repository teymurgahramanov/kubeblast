FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY public/ public/
COPY src/ src/
RUN npm run build

# Production Stage
FROM nginx:stable-alpine AS production
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]