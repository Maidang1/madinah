/* eslint-disable @typescript-eslint/no-explicit-any */
import { toc } from 'mdast-util-toc'

type Result = ReturnType<typeof toc>
type List = NonNullable<Result['map']>['children']

type AnyFunction = (...args: any) => any

export const extractTocItems = (data: List) => {
  const extractItem = (item: any) => {
    if (item.type === 'link') {
      return {
        url: item.url,
        value: item.children[0].value
      };
    }
    return null;
  };

  const traverse: AnyFunction = (node: any, level = 0) => {
    if (level > 4) {
      return [];
    }

    if (Array.isArray(node)) {
      return node.flatMap(child => traverse(child, level));
    }
    if (typeof node === 'object' && node !== null) {
      const result = [];
      const item = extractItem(node);
      if (item) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        item.level = level;
        result.push(item);
      }
      if (node.children) {
        result.push(...traverse(node.children, level + 1));
      }
      return result;
    }
    return [];
  };

  return traverse(data);
};
