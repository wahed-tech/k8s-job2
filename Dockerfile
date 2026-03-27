FROM alpine:3.22

ARG TARGETARCH

RUN apk add --no-cache --update ca-certificates

ADD build/app-${TARGETARCH} /bin/app

CMD exec /bin/app
