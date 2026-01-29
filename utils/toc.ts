/* eslint-disable @typescript-eslint/no-explicit-any */

export interface TocItem {
    value: string
    url: string
    level: number
}

/**
 * Extract table of contents items from mdast-util-toc result
 */
export function extractTocItems(children: any[]): TocItem[] {
    const items: TocItem[] = []

    function traverse(nodes: any[], level = 2) {
        for (const node of nodes) {
            if (node.type === 'listItem') {
                // Extract the link from the paragraph
                const paragraph = node.children?.find((child: any) => child.type === 'paragraph')
                const link = paragraph?.children?.find((child: any) => child.type === 'link')

                if (link) {
                    items.push({
                        value: link.children?.[0]?.value || '',
                        url: link.url || '',
                        level,
                    })
                }

                // Process nested lists
                const nestedList = node.children?.find((child: any) => child.type === 'list')
                if (nestedList?.children) {
                    traverse(nestedList.children, level + 1)
                }
            }
        }
    }

    traverse(children)
    return items
}
