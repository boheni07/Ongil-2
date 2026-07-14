// Sentry 소스맵/심볼리케이션을 위한 Metro 설정. Expo 기본 설정을 감싼다.
const { getSentryExpoConfig } = require("@sentry/react-native/metro");

const config = getSentryExpoConfig(__dirname);

module.exports = config;
