declare module 'virtual:blog-list' {
  const list: import(".").PostInfo[];
  export { list };
}
