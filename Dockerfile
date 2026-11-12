FROM public.ecr.aws/docker/library/node:22-bookworm-slim AS frontend
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html tsconfig.json vite.config.ts ./
COPY src ./src
COPY public ./public
RUN npm run build

FROM public.ecr.aws/docker/library/golang:1.25-bookworm AS backend
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY server ./server
RUN CGO_ENABLED=0 go build -trimpath -o /app/critter-holdem ./server

FROM public.ecr.aws/docker/library/debian:bookworm-slim
WORKDIR /app
COPY --from=backend /app/critter-holdem ./
COPY --from=frontend /app/dist ./dist
ENV PORT=3000
EXPOSE 3000
USER 65532:65532
ENTRYPOINT ["/app/critter-holdem"]
