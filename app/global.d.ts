import { PostInfo } from "./types";

declare module 'virtual:blog-list' {
  const list: PostInfo[];
  export default list;
}
