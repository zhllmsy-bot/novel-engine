import { type ReactNode } from 'react'

import { ScrollArea } from '@/components/ui/scroll-area'
import { TabsContent } from '@/components/ui/tabs'

export function InspectorSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="inspector-section">
      <div className="section-title">
        <span>{title}</span>
      </div>
      {children}
    </section>
  )
}

export function InspectorTabContent({
  value,
  children,
}: {
  value: string
  children: ReactNode
}) {
  return (
    <TabsContent className="inspector-tab-content" value={value}>
      <ScrollArea className="inspector-scroll">
        <div className="inspector-content">{children}</div>
      </ScrollArea>
    </TabsContent>
  )
}
