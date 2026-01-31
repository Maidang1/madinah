import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { useMDXComponents } from "@mdx-js/react";
function _createMdxContent(props) {
  const _components = {
    a: "a",
    code: "code",
    div: "div",
    h1: "h1",
    h2: "h2",
    p: "p",
    pre: "pre",
    span: "span",
    ...useMDXComponents(),
    ...props.components
  };
  return jsxs(Fragment, {
    children: [jsxs(_components.h1, {
      id: "为什么需要异步",
      children: ["为什么需要异步？", jsx(_components.a, {
        className: "header-anchor",
        href: "#为什么需要异步",
        children: jsx(_components.span, {
          className: "icon icon-link"
        })
      })]
    }), "\n", jsx(_components.p, {
      children: "在网络或 I/O 密集型的应用中，等待外部资源的时间往往远超过 CPU 执行计算的时间。传统的同步模型会让线程在等待时阻塞，造成资源浪费。"
    }), "\n", jsx(_components.p, {
      children: "异步模型让任务在等待时让出执行权，其他任务得以继续推进。Rust 的所有权系统确保即便在这种高并发场景下也能安全地共享数据。"
    }), "\n", jsxs(_components.h2, {
      id: "asyncawait-的基本语法",
      children: ["async/await 的基本语法", jsx(_components.a, {
        className: "header-anchor",
        href: "#asyncawait-的基本语法",
        children: jsx(_components.span, {
          className: "icon icon-link"
        })
      })]
    }), "\n", jsxs(_components.pre, {
      className: "shiki dark-plus",
      style: {
        backgroundColor: "#1E1E1E",
        color: "#D4D4D4"
      },
      children: [jsx(_components.div, {
        className: "language-id",
        children: "rust"
      }), jsx(_components.div, {
        className: "code-container",
        children: jsxs(_components.code, {
          children: [jsxs(_components.div, {
            className: "line",
            children: [jsx(_components.span, {
              style: {
                color: "#569CD6"
              },
              children: "async"
            }), jsx(_components.span, {
              style: {
                color: "#D4D4D4"
              },
              children: " "
            }), jsx(_components.span, {
              style: {
                color: "#569CD6"
              },
              children: "fn"
            }), jsx(_components.span, {
              style: {
                color: "#D4D4D4"
              },
              children: " "
            }), jsx(_components.span, {
              style: {
                color: "#DCDCAA"
              },
              children: "fetch_user"
            }), jsx(_components.span, {
              style: {
                color: "#D4D4D4"
              },
              children: "() -> "
            }), jsx(_components.span, {
              style: {
                color: "#4EC9B0"
              },
              children: "Result"
            }), jsx(_components.span, {
              style: {
                color: "#D4D4D4"
              },
              children: "<"
            }), jsx(_components.span, {
              style: {
                color: "#4EC9B0"
              },
              children: "User"
            }), jsx(_components.span, {
              style: {
                color: "#D4D4D4"
              },
              children: ", "
            }), jsx(_components.span, {
              style: {
                color: "#4EC9B0"
              },
              children: "Error"
            }), jsx(_components.span, {
              style: {
                color: "#D4D4D4"
              },
              children: "> {"
            })]
          }), jsxs(_components.div, {
            className: "line",
            children: [jsx(_components.span, {
              style: {
                color: "#D4D4D4"
              },
              children: "    "
            }), jsx(_components.span, {
              style: {
                color: "#569CD6"
              },
              children: "let"
            }), jsx(_components.span, {
              style: {
                color: "#D4D4D4"
              },
              children: " "
            }), jsx(_components.span, {
              style: {
                color: "#9CDCFE"
              },
              children: "response"
            }), jsx(_components.span, {
              style: {
                color: "#D4D4D4"
              },
              children: " = "
            }), jsx(_components.span, {
              style: {
                color: "#4EC9B0"
              },
              children: "http_client"
            }), jsx(_components.span, {
              style: {
                color: "#D4D4D4"
              },
              children: "::"
            }), jsx(_components.span, {
              style: {
                color: "#DCDCAA"
              },
              children: "get"
            }), jsx(_components.span, {
              style: {
                color: "#D4D4D4"
              },
              children: "("
            }), jsx(_components.span, {
              style: {
                color: "#CE9178"
              },
              children: '"https://example.com/user"'
            }), jsx(_components.span, {
              style: {
                color: "#D4D4D4"
              },
              children: ")."
            }), jsx(_components.span, {
              style: {
                color: "#C586C0"
              },
              children: "await"
            }), jsx(_components.span, {
              style: {
                color: "#D4D4D4"
              },
              children: "?;"
            })]
          }), jsxs(_components.div, {
            className: "line",
            children: [jsx(_components.span, {
              style: {
                color: "#D4D4D4"
              },
              children: "    "
            }), jsx(_components.span, {
              style: {
                color: "#DCDCAA"
              },
              children: "parse_response"
            }), jsx(_components.span, {
              style: {
                color: "#D4D4D4"
              },
              children: "("
            }), jsx(_components.span, {
              style: {
                color: "#9CDCFE"
              },
              children: "response"
            }), jsx(_components.span, {
              style: {
                color: "#D4D4D4"
              },
              children: ")"
            })]
          }), jsx(_components.div, {
            className: "line",
            children: jsx(_components.span, {
              style: {
                color: "#D4D4D4"
              },
              children: "}"
            })
          })]
        })
      })]
    }), "\n", jsxs(_components.p, {
      children: [jsx(_components.code, {
        children: "async"
      }), " 关键字让函数返回一个实现 ", jsx(_components.code, {
        children: "Future"
      }), " 的类型，而 ", jsx(_components.code, {
        children: "await"
      }), " 则在任务可以安全继续执行时恢复控制权。理解 ", jsx(_components.code, {
        children: "Future"
      }), " 的状态机实现对于后续章节至关重要。"]
    })]
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
