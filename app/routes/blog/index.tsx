// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
// eslint-disable-next-line import/no-unresolved
import { list } from "virtual:blog-list"


export default function BlogList() {
  console.log("virrtual", list)
  return <div>{JSON.stringify(list)}</div>
}