import { PanelRightOpen } from 'lucide-react'

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { InspectorTabContent } from './components'
import { MemoryPanel } from './MemoryPanel'
import { ProviderPanel } from './ProviderPanel'
import { PublishPanel } from './PublishPanel'
import { SkillsPanel } from './SkillsPanel'
import { StoryGraphPanel } from './StoryGraphPanel'
import type { NarrativeInspectorProps } from './types'

export function NarrativeInspector(props: NarrativeInspectorProps) {
  return (
    <aside className="inspector">
      <div className="inspector-title">
        <PanelRightOpen aria-hidden="true" />
        <strong>上下文</strong>
      </div>

      <Tabs className="inspector-tabs" defaultValue="memory">
        <TabsList aria-label="Inspector sections" className="inspector-tab-list">
          <TabsTrigger value="memory">记忆</TabsTrigger>
          <TabsTrigger value="graph">图谱</TabsTrigger>
          <TabsTrigger value="skills">技能</TabsTrigger>
          <TabsTrigger value="publish">发布</TabsTrigger>
          <TabsTrigger value="provider">模型</TabsTrigger>
        </TabsList>

        <InspectorTabContent value="memory">
          <MemoryPanel
            activeChapter={props.activeChapter}
            codexEntries={props.codexEntries}
            runtimeMemories={props.runtimeMemories}
            runtimeMemoryPlan={props.runtimeMemoryPlan}
            activeChapterSummary={props.activeChapterSummary}
            volumeSummaries={props.volumeSummaries}
            chapterVersions={props.chapterVersions}
            characterStateLogs={props.characterStateLogs}
            plotThreads={props.plotThreads}
            onRestoreVersion={props.onRestoreVersion}
          />
        </InspectorTabContent>

        <InspectorTabContent value="graph">
          <StoryGraphPanel
            activeChapter={props.activeChapter}
            projectTitle={props.projectTitle}
            initialGraphSnapshot={props.initialGraphSnapshot}
            onGraphSnapshotChange={props.onGraphSnapshotChange}
            codexEntries={props.codexEntries}
            runtimeMemories={props.runtimeMemories}
            runtimeMemoryPlan={props.runtimeMemoryPlan}
            activeChapterSummary={props.activeChapterSummary}
            volumeSummaries={props.volumeSummaries}
            chapterVersions={props.chapterVersions}
            characterStateLogs={props.characterStateLogs}
            plotThreads={props.plotThreads}
            lastSkillAudit={props.lastSkillAudit}
            lastResult={props.lastResult}
            publishPlan={props.publishPlan}
            publisherReport={props.publisherReport}
            onRestoreVersion={props.onRestoreVersion}
          />
        </InspectorTabContent>

        <InspectorTabContent value="skills">
          <SkillsPanel
            skillCatalog={props.skillCatalog}
            agentToolExecution={props.agentToolExecution}
            agentToolRunning={props.agentToolRunning}
            onRunAgentTool={props.onRunAgentTool}
            runningSkillId={props.runningSkillId}
            lastSkillAudit={props.lastSkillAudit}
            runtimeError={props.runtimeError}
            lastResult={props.lastResult}
            rewritePatch={props.rewritePatch}
            diffParts={props.diffParts}
            patchValidation={props.patchValidation}
            acceptedStateProposalKeys={props.acceptedStateProposalKeys}
            acceptedPlotThreadProposalKeys={props.acceptedPlotThreadProposalKeys}
            onRunSkill={props.onRunSkill}
            onPreviewSkill={props.onPreviewSkill}
            onConfirmStateProposal={props.onConfirmStateProposal}
            onConfirmPlotThreadProposal={props.onConfirmPlotThreadProposal}
            onAcceptPatch={props.onAcceptPatch}
            onRejectPatch={props.onRejectPatch}
          />
        </InspectorTabContent>

        <InspectorTabContent value="publish">
          <PublishPanel
            publisherAdapters={props.publisherAdapters}
            publisherAdapterErrors={props.publisherAdapterErrors}
            activePublisherAdapterId={props.activePublisherAdapterId}
            publishPlan={props.publishPlan}
            publisherRunning={props.publisherRunning}
            publisherReport={props.publisherReport}
            onRunPublisherPreview={props.onRunPublisherPreview}
            onPublisherAdapterChange={props.onPublisherAdapterChange}
          />
        </InspectorTabContent>

        <InspectorTabContent value="provider">
          <ProviderPanel
            providerMode={props.providerMode}
            providerConfig={props.providerConfig}
            providerAdapters={props.providerAdapters}
            providerAdapterErrors={props.providerAdapterErrors}
            onProviderModeChange={props.onProviderModeChange}
            onProviderConfigChange={props.onProviderConfigChange}
          />
        </InspectorTabContent>
      </Tabs>
    </aside>
  )
}
