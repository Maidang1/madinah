declare module 'virtual:blog-list' {
  const list: import("./types").PostInfo[];
  export { list };
}

declare module 'virtual:rust-list' {
  const list: import("./types").PostInfo[];
  export { list };
}