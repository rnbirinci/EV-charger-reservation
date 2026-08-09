# --- build stage: compile a static binary ---
FROM golang:1.26-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /server ./cmd/server

# --- run stage: just the binary on a tiny image, as a non-root user ---
FROM alpine:3.20
RUN adduser -D -u 10001 app
USER app
COPY --from=build /server /server
EXPOSE 8080
ENTRYPOINT ["/server"]
