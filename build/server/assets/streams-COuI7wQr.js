import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { useMDXComponents } from "@mdx-js/react";
function _createMdxContent(props) {
  const _components = {
    a: "a",
    code: "code",
    div: "div",
    h1: "h1",
    h2: "h2",
    li: "li",
    p: "p",
    pre: "pre",
    span: "span",
    strong: "strong",
    ul: "ul",
    ...useMDXComponents(),
    ...props.components
  };
  return jsxs(Fragment, {
    children: [jsxs(_components.h1, {
      id: "stream-基础",
      children: ["Stream 基础", jsx(_components.a, {
        className: "header-anchor",
        href: "#stream-基础",
        children: jsx(_components.span, {
          className: "icon icon-link"
        })
      })]
    }), "\n", jsxs(_components.p, {
      children: [jsx(_components.code, {
        children: "Stream"
      }), " 类似于异步迭代器，按需产出值。组合器如 ", jsx(_components.code, {
        children: "map"
      }), ", ", jsx(_components.code, {
        children: "filter"
      }), " 让你像处理同步迭代器一样优雅地处理异步数据流。"]
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
              children: "use"
            }), jsx(_components.span, {
              style: {
                color: "#D4D4D4"
              },
              children: " "
            }), jsx(_components.span, {
              style: {
                color: "#4EC9B0"
              },
              children: "futures"
            }), jsx(_components.span, {
              style: {
                color: "#D4D4D4"
              },
              children: "::{"
            }), jsx(_components.span, {
              style: {
                color: "#4EC9B0"
              },
              children: "StreamExt"
            }), jsx(_components.span, {
              style: {
                color: "#D4D4D4"
              },
              children: ", stream};"
            })]
          }), jsx(_components.div, {
            className: "line"
          }), jsxs(_components.div, {
            className: "line",
            children: [jsx(_components.span, {
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
              children: "numbers"
            }), jsx(_components.span, {
              style: {
                color: "#D4D4D4"
              },
              children: " = "
            }), jsx(_components.span, {
              style: {
                color: "#4EC9B0"
              },
              children: "stream"
            }), jsx(_components.span, {
              style: {
                color: "#D4D4D4"
              },
              children: "::"
            }), jsx(_components.span, {
              style: {
                color: "#DCDCAA"
              },
              children: "iter"
            }), jsx(_components.span, {
              style: {
                color: "#D4D4D4"
              },
              children: "("
            }), jsx(_components.span, {
              style: {
                color: "#DCDCAA"
              },
              children: "vec!"
            }), jsx(_components.span, {
              style: {
                color: "#D4D4D4"
              },
              children: "["
            }), jsx(_components.span, {
              style: {
                color: "#B5CEA8"
              },
              children: "1"
            }), jsx(_components.span, {
              style: {
                color: "#D4D4D4"
              },
              children: ", "
            }), jsx(_components.span, {
              style: {
                color: "#B5CEA8"
              },
              children: "2"
            }), jsx(_components.span, {
              style: {
                color: "#D4D4D4"
              },
              children: ", "
            }), jsx(_components.span, {
              style: {
                color: "#B5CEA8"
              },
              children: "3"
            }), jsx(_components.span, {
              style: {
                color: "#D4D4D4"
              },
              children: "]);"
            })]
          }), jsxs(_components.div, {
            className: "line",
            children: [jsx(_components.span, {
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
              children: "doubled"
            }), jsx(_components.span, {
              style: {
                color: "#D4D4D4"
              },
              children: ": "
            }), jsx(_components.span, {
              style: {
                color: "#4EC9B0"
              },
              children: "Vec"
            }), jsx(_components.span, {
              style: {
                color: "#D4D4D4"
              },
              children: "<"
            }), jsx(_components.span, {
              style: {
                color: "#9CDCFE"
              },
              children: "_"
            }), jsx(_components.span, {
              style: {
                color: "#D4D4D4"
              },
              children: "> = "
            }), jsx(_components.span, {
              style: {
                color: "#9CDCFE"
              },
              children: "numbers"
            }), jsx(_components.span, {
              style: {
                color: "#D4D4D4"
              },
              children: "."
            }), jsx(_components.span, {
              style: {
                color: "#DCDCAA"
              },
              children: "map"
            }), jsx(_components.span, {
              style: {
                color: "#D4D4D4"
              },
              children: "(|"
            }), jsx(_components.span, {
              style: {
                color: "#9CDCFE"
              },
              children: "n"
            }), jsx(_components.span, {
              style: {
                color: "#D4D4D4"
              },
              children: "| "
            }), jsx(_components.span, {
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
              children: "move"
            }), jsx(_components.span, {
              style: {
                color: "#D4D4D4"
              },
              children: " { "
            }), jsx(_components.span, {
              style: {
                color: "#9CDCFE"
              },
              children: "n"
            }), jsx(_components.span, {
              style: {
                color: "#D4D4D4"
              },
              children: " * "
            }), jsx(_components.span, {
              style: {
                color: "#B5CEA8"
              },
              children: "2"
            }), jsx(_components.span, {
              style: {
                color: "#D4D4D4"
              },
              children: " })."
            }), jsx(_components.span, {
              style: {
                color: "#DCDCAA"
              },
              children: "buffer_unordered"
            }), jsx(_components.span, {
              style: {
                color: "#D4D4D4"
              },
              children: "("
            }), jsx(_components.span, {
              style: {
                color: "#B5CEA8"
              },
              children: "2"
            }), jsx(_components.span, {
              style: {
                color: "#D4D4D4"
              },
              children: ")."
            }), jsx(_components.span, {
              style: {
                color: "#DCDCAA"
              },
              children: "collect"
            }), jsx(_components.span, {
              style: {
                color: "#D4D4D4"
              },
              children: "()."
            }), jsx(_components.span, {
              style: {
                color: "#C586C0"
              },
              children: "await"
            }), jsx(_components.span, {
              style: {
                color: "#D4D4D4"
              },
              children: ";"
            })]
          })]
        })
      })]
    }), "\n", jsxs(_components.h2, {
      id: "并发模式",
      children: ["并发模式", jsx(_components.a, {
        className: "header-anchor",
        href: "#并发模式",
        children: jsx(_components.span, {
          className: "icon icon-link"
        })
      })]
    }), "\n", jsxs(_components.ul, {
      children: ["\n", jsxs(_components.li, {
        children: [jsx(_components.strong, {
          children: "Join"
        }), ": 同时等待多个 Future 完成。"]
      }), "\n", jsxs(_components.li, {
        children: [jsx(_components.strong, {
          children: "Select"
        }), ": 竞速执行，先完成的任务先处理。"]
      }), "\n", jsxs(_components.li, {
        children: [jsx(_components.strong, {
          children: "Timeout"
        }), ": 为关键操作设置超时，避免无限等待。"]
      }), "\n"]
    }), "\n", jsx(_components.p, {
      children: "通过组合这些模式，可以构建稳定的爬虫、数据处理流水线或实时服务。"
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
