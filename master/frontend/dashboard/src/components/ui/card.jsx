import * as React from "react"
import { ChevronDown, ChevronUp } from "lucide-react"

const Card = React.forwardRef(({ className, collapsible = false, defaultCollapsed = false, ...props }, ref) => {
  const [isCollapsed, setIsCollapsed] = React.useState(defaultCollapsed);

  return (
    <div
      ref={ref}
      className={`rounded-lg border bg-card text-card-foreground shadow-sm ${className}`}
      {...props}
    />
  )
})
Card.displayName = "Card"

const CardHeader = React.forwardRef(({ className, collapsible = false, isCollapsed = false, onToggle, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={`flex flex-row items-center justify-between p-6 ${className} ${
        collapsible ? 'cursor-pointer select-none' : ''
      }`}
      onClick={collapsible ? onToggle : undefined}
    >
      <div className="flex flex-col space-y-1.5">
        {props.children}
      </div>
      {collapsible && (
        <div className="flex items-center text-gray-500 hover:text-gray-700 transition-colors">
          {isCollapsed ? (
            <ChevronDown className="h-5 w-5" />
          ) : (
            <ChevronUp className="h-5 w-5" />
          )}
        </div>
      )}
    </div>
  )
})
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={`text-2xl font-semibold leading-none tracking-tight ${className}`}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardContent = React.forwardRef(({ className, collapsed = false, ...props }, ref) => (
  <div
    ref={ref}
    className={`overflow-hidden transition-all duration-300 ease-in-out ${
      collapsed ? 'h-0 p-0' : 'p-6 pt-0'
    } ${className}`}
    {...props}
  />
))
CardContent.displayName = "CardContent"

// New CollapsibleCard component that wraps everything together
const CollapsibleCard = React.forwardRef(({ 
  className,
  title,
  defaultCollapsed = false,
  headerClassName,
  contentClassName,
  children,
  ...props 
}, ref) => {
  const [isCollapsed, setIsCollapsed] = React.useState(defaultCollapsed);

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <Card ref={ref} className={className} {...props}>
      <CardHeader
        collapsible
        isCollapsed={isCollapsed}
        onToggle={toggleCollapse}
        className={headerClassName}
      >
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent collapsed={isCollapsed} className={contentClassName}>
        {children}
      </CardContent>
    </Card>
  );
});
CollapsibleCard.displayName = "CollapsibleCard"

export { Card, CardHeader, CardTitle, CardContent, CollapsibleCard }