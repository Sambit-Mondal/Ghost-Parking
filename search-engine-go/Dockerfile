# Stage 1: Build static Go binary
FROM golang:1.22-alpine AS builder

WORKDIR /app

RUN apk add --no-cache git ca-certificates tzdata

COPY go.mod go.sum ./
RUN go mod download

COPY . .

# Build statically linked binary with CGO disabled
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o search-engine-go .

# Stage 2: Minimal runtime container
FROM alpine:3.19

WORKDIR /app

RUN apk add --no-cache ca-certificates tzdata

COPY --from=builder /app/search-engine-go /app/search-engine-go

EXPOSE 8080

ENV PORT=8080
ENV ENVIRONMENT=production

CMD ["/app/search-engine-go"]
