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
      id: "future-的本质",
      children: ["Future 的本质", jsx(_components.a, {
        className: "header-anchor",
        href: "#future-的本质",
        children: jsx(_components.span, {
          className: "icon icon-link"
        })
      })]
    }), "\n", jsxs(_components.p, {
      children: [jsx(_components.code, {
        children: "Future"
      }), " 是一个状态机，封装了某个异步计算的推进逻辑。核心方法是 ", jsx(_components.code, {
        children: "poll"
      }), "，它会返回一个 ", jsx(_components.code, {
        children: "Poll::Ready"
      }), " 或 ", jsx(_components.code, {
        children: "Poll::Pending"
      }), "。"]
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
              children: "impl"
            }), jsx(_components.span, {
              style: {
                color: "#D4D4D4"
              },
              children: " "
            }), jsx(_components.span, {
              style: {
                color: "#4EC9B0"
              },
              children: "Future"
            }), jsx(_components.span, {
              style: {
                color: "#D4D4D4"
              },
              children: " "
            }), jsx(_components.span, {
              style: {
                color: "#C586C0"
              },
              children: "for"
            }), jsx(_components.span, {
              style: {
                color: "#D4D4D4"
              },
              children: " "
            }), jsx(_components.span, {
              style: {
                color: "#4EC9B0"
              },
              children: "MyFuture"
            }), jsx(_components.span, {
              style: {
                color: "#D4D4D4"
              },
              children: " {"
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
              children: "type"
            }), jsx(_components.span, {
              style: {
                color: "#D4D4D4"
              },
              children: " "
            }), jsx(_components.span, {
              style: {
                color: "#4EC9B0"
              },
              children: "Output"
            }), jsx(_components.span, {
              style: {
                color: "#D4D4D4"
              },
              children: " = "
            }), jsx(_components.span, {
              style: {
                color: "#4EC9B0"
              },
              children: "usize"
            }), jsx(_components.span, {
              style: {
                color: "#D4D4D4"
              },
              children: ";"
            })]
          }), jsx(_components.div, {
            className: "line"
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
              children: "poll"
            }), jsx(_components.span, {
              style: {
                color: "#D4D4D4"
              },
              children: "("
            }), jsx(_components.span, {
              style: {
                color: "#569CD6"
              },
              children: "self"
            }), jsx(_components.span, {
              style: {
                color: "#D4D4D4"
              },
              children: ": "
            }), jsx(_components.span, {
              style: {
                color: "#4EC9B0"
              },
              children: "Pin"
            }), jsx(_components.span, {
              style: {
                color: "#D4D4D4"
              },
              children: "<&"
            }), jsx(_components.span, {
              style: {
                color: "#569CD6"
              },
              children: "mut"
            }), jsx(_components.span, {
              style: {
                color: "#D4D4D4"
              },
              children: " "
            }), jsx(_components.span, {
              style: {
                color: "#569CD6"
              },
              children: "Self"
            }), jsx(_components.span, {
              style: {
                color: "#D4D4D4"
              },
              children: ">, "
            }), jsx(_components.span, {
              style: {
                color: "#9CDCFE"
              },
              children: "cx"
            }), jsx(_components.span, {
              style: {
                color: "#D4D4D4"
              },
              children: ": &"
            }), jsx(_components.span, {
              style: {
                color: "#569CD6"
              },
              children: "mut"
            }), jsx(_components.span, {
              style: {
                color: "#D4D4D4"
              },
              children: " "
            }), jsx(_components.span, {
              style: {
                color: "#4EC9B0"
              },
              children: "Context"
            }), jsx(_components.span, {
              style: {
                color: "#D4D4D4"
              },
              children: "<'"
            }), jsx(_components.span, {
              style: {
                color: "#4EC9B0"
              },
              children: "_"
            }), jsx(_components.span, {
              style: {
                color: "#D4D4D4"
              },
              children: ">) -> "
            }), jsx(_components.span, {
              style: {
                color: "#4EC9B0"
              },
              children: "Poll"
            }), jsx(_components.span, {
              style: {
                color: "#D4D4D4"
              },
              children: "<"
            }), jsx(_components.span, {
              style: {
                color: "#569CD6"
              },
              children: "Self"
            }), jsx(_components.span, {
              style: {
                color: "#D4D4D4"
              },
              children: "::"
            }), jsx(_components.span, {
              style: {
                color: "#4EC9B0"
              },
              children: "Output"
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
              children: "        "
            }), jsx(_components.span, {
              style: {
                color: "#C586C0"
              },
              children: "if"
            }), jsx(_components.span, {
              style: {
                color: "#D4D4D4"
              },
              children: " "
            }), jsx(_components.span, {
              style: {
                color: "#569CD6"
              },
              children: "self"
            }), jsx(_components.span, {
              style: {
                color: "#D4D4D4"
              },
              children: "."
            }), jsx(_components.span, {
              style: {
                color: "#DCDCAA"
              },
              children: "is_ready"
            }), jsx(_components.span, {
              style: {
                color: "#D4D4D4"
              },
              children: "() {"
            })]
          }), jsxs(_components.div, {
            className: "line",
            children: [jsx(_components.span, {
              style: {
                color: "#D4D4D4"
              },
              children: "            "
            }), jsx(_components.span, {
              style: {
                color: "#4EC9B0"
              },
              children: "Poll"
            }), jsx(_components.span, {
              style: {
                color: "#D4D4D4"
              },
              children: "::"
            }), jsx(_components.span, {
              style: {
                color: "#DCDCAA"
              },
              children: "Ready"
            }), jsx(_components.span, {
              style: {
                color: "#D4D4D4"
              },
              children: "("
            }), jsx(_components.span, {
              style: {
                color: "#569CD6"
              },
              children: "self"
            }), jsx(_components.span, {
              style: {
                color: "#D4D4D4"
              },
              children: ".value)"
            })]
          }), jsxs(_components.div, {
            className: "line",
            children: [jsx(_components.span, {
              style: {
                color: "#D4D4D4"
              },
              children: "        } "
            }), jsx(_components.span, {
              style: {
                color: "#C586C0"
              },
              children: "else"
            }), jsx(_components.span, {
              style: {
                color: "#D4D4D4"
              },
              children: " {"
            })]
          }), jsxs(_components.div, {
            className: "line",
            children: [jsx(_components.span, {
              style: {
                color: "#D4D4D4"
              },
              children: "            "
            }), jsx(_components.span, {
              style: {
                color: "#9CDCFE"
              },
              children: "cx"
            }), jsx(_components.span, {
              style: {
                color: "#D4D4D4"
              },
              children: "."
            }), jsx(_components.span, {
              style: {
                color: "#DCDCAA"
              },
              children: "waker"
            }), jsx(_components.span, {
              style: {
                color: "#D4D4D4"
              },
              children: "()."
            }), jsx(_components.span, {
              style: {
                color: "#DCDCAA"
              },
              children: "wake_by_ref"
            }), jsx(_components.span, {
              style: {
                color: "#D4D4D4"
              },
              children: "();"
            })]
          }), jsxs(_components.div, {
            className: "line",
            children: [jsx(_components.span, {
              style: {
                color: "#D4D4D4"
              },
              children: "            "
            }), jsx(_components.span, {
              style: {
                color: "#4EC9B0"
              },
              children: "Poll"
            }), jsx(_components.span, {
              style: {
                color: "#D4D4D4"
              },
              children: "::"
            }), jsx(_components.span, {
              style: {
                color: "#4EC9B0"
              },
              children: "Pending"
            })]
          }), jsx(_components.div, {
            className: "line",
            children: jsx(_components.span, {
              style: {
                color: "#D4D4D4"
              },
              children: "        }"
            })
          }), jsx(_components.div, {
            className: "line",
            children: jsx(_components.span, {
              style: {
                color: "#D4D4D4"
              },
              children: "    }"
            })
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
    }), "\n", jsxs(_components.h2, {
      id: "执行器executor",
      children: ["执行器（Executor）", jsx(_components.a, {
        className: "header-anchor",
        href: "#执行器executor",
        children: jsx(_components.span, {
          className: "icon icon-link"
        })
      })]
    }), "\n", jsxs(_components.p, {
      children: ["执行器负责轮询 Future。当 Future 返回 ", jsx(_components.code, {
        children: "Poll::Pending"
      }), " 时，它会通过 ", jsx(_components.code, {
        children: "Waker"
      }), " 注册唤醒逻辑。常见的执行器有 ", jsx(_components.code, {
        children: "tokio"
      }), ", ", jsx(_components.code, {
        children: "async-std"
      }), ", 以及标准库中的 ", jsx(_components.code, {
        children: "futures::executor"
      }), "。"]
    }), "\n", jsx(_components.p, {
      children: "合理地选择执行器、任务调度策略和超时机制，是构建高性能服务的关键。"
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
