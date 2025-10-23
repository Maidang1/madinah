# Design Document

## Overview

This design document outlines the enhancement of code block styling and functionality for the blog system. The current implementation uses `remark-shiki-twoslash` for syntax highlighting with basic CSS styling. We will enhance the visual presentation, particularly for plaintext code blocks, add interactive features like copy functionality, and improve the overall user experience while maintaining the existing architecture.

## Architecture

### Current Architecture

- **MDX Processing**: Vite plugin processes MDX files with remark/rehype plugins
- **Syntax Highlighting**: `remark-shiki-twoslash` provides syntax highlighting with dual themes (vitesse-light/vitesse-dark)
- **Component System**: MDX components defined in `app/core/mdx/mdx-components.tsx`
- **Styling**: CSS-based styling in `app/styles/mdx.css` and Tailwind utilities

### Enhanced Architecture

- **Code Block Wrapper Component**: New React component to wrap all code blocks
- **Interactive Features**: Copy button, language badge, and enhanced styling
- **Theme Integration**: Seamless integration with existing light/dark theme system
- **Accessibility**: WCAG compliant contrast ratios and keyboard navigation

## Components and Interfaces

### 1. Enhanced Pre Component

```typescript
interface CodeBlockProps {
  children: ReactNode;
  className?: string;
  'data-language'?: string;
  'data-theme'?: string;
}

interface CodeBlockState {
  copied: boolean;
  language: string;
  showCopyButton: boolean;
}
```

The enhanced Pre component will:

- Detect language from className or data attributes
- Provide copy functionality with visual feedback
- Display language badges for identification
- Apply enhanced styling for both syntax-highlighted and plaintext blocks

### 2. Copy Button Component

```typescript
interface CopyButtonProps {
  code: string;
  onCopy?: (success: boolean) => void;
  className?: string;
}
```

Features:

- Clipboard API integration with fallback
- Visual feedback (copied state)
- Accessibility support (ARIA labels, keyboard navigation)
- Smooth animations respecting `prefers-reduced-motion`

### 3. Language Badge Component

```typescript
interface LanguageBadgeProps {
  language: string;
  className?: string;
}
```

Features:

- Language detection and display
- Consistent styling across themes
- Special handling for plaintext/unknown languages

## Data Models

### Code Block Metadata

```typescript
interface CodeBlockMetadata {
  language: string;
  content: string;
  lineCount: number;
  hasLineNumbers?: boolean;
  theme: 'light' | 'dark';
}
```

### Theme Configuration

```typescript
interface CodeBlockTheme {
  background: string;
  foreground: string;
  border: string;
  shadow: string;
  copyButton: {
    background: string;
    hover: string;
    text: string;
  };
  languageBadge: {
    background: string;
    text: string;
  };
}
```

## Error Handling

### Copy Operation Failures

- Graceful fallback for browsers without Clipboard API
- User-friendly error messages
- Fallback to text selection for manual copying

### Language Detection Failures

- Default to "text" for unknown languages
- Consistent styling regardless of language detection success
- No breaking of code block rendering

### Theme System Integration

- Fallback to system theme if theme detection fails
- Consistent styling across theme transitions
- No flash of unstyled content (FOUC)

## Testing Strategy

### Unit Tests

- Copy functionality across different browsers
- Language detection accuracy
- Theme switching behavior
- Accessibility compliance

### Integration Tests

- MDX rendering with enhanced code blocks
- Theme system integration
- Performance impact measurement

### Visual Regression Tests

- Code block appearance across themes
- Interactive state changes
- Responsive behavior

## Implementation Details

### CSS Architecture

#### Base Styles

```css
.enhanced-code-block {
  position: relative;
  border-radius: 0.75rem;
  overflow: hidden;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  border: 1px solid var(--code-border);
  background: var(--code-background);
}
```

#### Plaintext Enhancement

```css
.code-block-plaintext {
  background: var(--code-plaintext-bg);
  color: var(--code-plaintext-color);
  font-family: var(--font-mono);
  line-height: 1.6;
  padding: 1.5rem;
}
```

#### Interactive Elements

```css
.copy-button {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.enhanced-code-block:hover .copy-button {
  opacity: 1;
}
```

### Theme Variables

#### Light Theme

```css
:root {
  --code-background: #fafafa;
  --code-border: #e5e7eb;
  --code-plaintext-bg: #f8fafc;
  --code-plaintext-color: #374151;
  --code-copy-button-bg: rgba(255, 255, 255, 0.9);
  --code-copy-button-hover: rgba(255, 255, 255, 1);
}
```

#### Dark Theme

```css
.dark {
  --code-background: #1e1e1e;
  --code-border: #374151;
  --code-plaintext-bg: #111827;
  --code-plaintext-color: #d1d5db;
  --code-copy-button-bg: rgba(31, 41, 55, 0.9);
  --code-copy-button-hover: rgba(31, 41, 55, 1);
}
```

### Component Integration

#### MDX Component Registration

```typescript
// Update mdx-components.tsx
export const mdxComponents = {
  // ... existing components
  pre: EnhancedCodeBlock,
  code: InlineCode,
};
```

#### Shiki Integration

The enhanced code blocks will work seamlessly with the existing `remark-shiki-twoslash` setup:

- Preserve syntax highlighting functionality
- Enhance visual presentation
- Add interactive features without breaking existing behavior

### Performance Considerations

#### Lazy Loading

- Copy button rendered only on hover/focus
- Language detection cached per block
- Minimal JavaScript bundle impact

#### CSS Optimization

- CSS custom properties for theme switching
- Minimal additional CSS footprint
- Reuse existing design tokens

#### Accessibility Features

- Proper ARIA labels for interactive elements
- Keyboard navigation support
- High contrast mode compatibility
- Screen reader friendly content structure

### Browser Compatibility

- Modern browsers with CSS custom properties support
- Graceful degradation for older browsers
- Clipboard API with fallback support
- CSS Grid/Flexbox for layout

## Migration Strategy

### Phase 1: Enhanced Styling

- Update CSS for improved visual presentation
- Add theme variables for code blocks
- Enhance plaintext block styling

### Phase 2: Interactive Features

- Implement copy button functionality
- Add language badge display
- Integrate with existing MDX component system

### Phase 3: Polish and Optimization

- Performance optimization
- Accessibility improvements
- Cross-browser testing and fixes

The design maintains backward compatibility while significantly enhancing the user experience for code blocks, with particular attention to plaintext content presentation and interactive functionality.
