declare module 'virtual:blog-list' {
  const list: import(".").PostInfo[];
  export { list };
}

declare module 'virtual:rust-list' {
  const list: import(".").PostInfo[];
  export { list };
}