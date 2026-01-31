import { jsx, jsxs } from "react/jsx-runtime";
import { useMDXComponents } from "@mdx-js/react";
function _createMdxContent(props) {
  const _components = {
    code: "code",
    p: "p",
    ...useMDXComponents(),
    ...props.components
  };
  return jsxs(_components.p, {
    children: ["Rust 的异步生态正在快速发展，本书会用循序渐进的方式带你理解为什么需要异步、", jsx(_components.code, {
      children: "Future"
    }), " trait 的工作原理，以及如何在真实项目中组合执行器、任务与 Stream。每一章都会提供实践建议，让你可以立即动手实验。"]
  });
}
function MDXContent(props = {}) {
  const { wrapper: MDXLayout } = {
    ...useMDXComponents(),
    ...props.components
  };
  return MDXLayout ? jsx(MDXLayout, {
    ...props,
    children: jsx(_createMdxContent, {
      ...props
    })
  }) : _createMdxContent(props);
}
export {
  MDXContent as default
};
