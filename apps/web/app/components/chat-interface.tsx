import "highlight.js/styles/github-dark.css";
import { ChatInput } from "./chat-input";

import { ToolManager } from "./tool-manager";
import type { ChatInterfaceProps } from "~/lib/chat/types";
import { useChatMessages } from "~/hooks/chat/useChatMessages";
import { useTextToSpeech } from "~/hooks/chat/useTextToSpeech";
import { useToolExecution } from "~/hooks/chat/useToolExecution";
import { useHandleChatSubMessage } from "~/hooks/chat/useHandleChatSubMessage";
import { useHandleRetry } from "~/hooks/chat/useHandleRetry";
import { useHandleDelete } from "~/hooks/chat/useHandleDelete";
import { useWebSocketStream } from "~/hooks/chat/useWebSocketStream";
import { useChatSubmission } from "~/hooks/chat/useChatSubmission";
import { useHandleBranch } from "~/hooks/chat/useHandleBranch";
import { useHandleEdit } from "~/hooks/chat/useHandleEdit";
import { useHandleSystemPromptEdit } from "~/hooks/chat/useHandleSystemPromptEdit";
import { EmptyChat } from "./chat/message/EmptyChat";
import { MessageContent } from "./chat/message/MessageContent";

export function ChatInterface({
  chatId,
  initialMessages = [],
}: ChatInterfaceProps) {
  const {
    apiKeyInfo,
    navigate,
    modelsData,
    modelsLoading,
    modelsError,
    model,
    isNewChat,
    isLoading,
    setIsLoading,
    assistantMessage,
    messages,
    messagesRef,
    setMessages,
    streamingMessageId,
    streamingMessageIdRef,
    updateStreamingMessageId,
    selectedModel,
    setSelectedModel,
    showToolManager,
    setShowToolManager,
    pendingToolCallsRef,
    chatInputRef,
    chatSettings: _chatSettings,
    scrollNewMessage,
    messagesEndRef,
    onStop,
  } = useChatMessages({ initialMessages, chatId });

  const { chatSettings, updateTtsEnabled, updateSelectedVoice } = _chatSettings;

  const {
    flushTtsBuffer,
    speakingMessageId,
    toggleSpeakMessage,
    onNewContent,
  } = useTextToSpeech({
    messagesRef,
    chatSettings: _chatSettings,
  });

  const handleSubmit = useChatSubmission({
    chatId,
    assistantMessage,
    isLoading,
    setIsLoading,
    updateStreamingMessageId,
    messagesRef,
    setMessages,
    selectedModel,
    chatSettings,
    isNewChat,
    scrollNewMessage,
    initialMessages,
    model,
  });

  const handleChatSubMessage = useHandleChatSubMessage({
    messagesRef,
    setMessages,
    selectedModel,
    setIsLoading,
    assistantMessage,
    updateStreamingMessageId,
    scrollNewMessage,
    navigate,
  });

  const handleDelete = useHandleDelete({
    chatId,
    setMessages,
  });

  const handleRetry = useHandleRetry({
    messagesRef,
    setMessages,
    selectedModel,
    isLoading,
    setIsLoading,
    assistantMessage,
    updateStreamingMessageId,
    chatSettings,
    chatId,
    handleDelete,
    modelsData,
  });

  const executeToolsAndContinue = useToolExecution({
    setIsLoading,
    chatSettings,
    assistantMessage,
    messagesRef,
    handleRetry,
    selectedModel,
    setMessages,
    updateStreamingMessageId,
    chatId,
    pendingToolCallsRef,
    streamingMessageIdRef,
  });

  useWebSocketStream({
    chatId,
    assistantMessage,
    setIsLoading,
    updateStreamingMessageId,
    messagesRef,
    setMessages,
    selectedModel,
    pendingToolCallsRef,
    streamingMessageIdRef,
    chatSettings,
    flushTtsBuffer,
    onNewContent,
    executeToolsAndContinue,
    isNewChat,
    chatInputRef,
    handleChatSubMessage,
  });

  const handleBranch = useHandleBranch({ chatId });

  const handleEdit = useHandleEdit({
    chatId,
    messagesRef,
    setMessages,
    handleDelete,
    handleSubmit,
    handleRetry,
  });

  const handleSystemPromptEdit = useHandleSystemPromptEdit({
    messagesRef,
    setMessages,
    chatSettings,
    handleEdit,
  });

  return (
    <>
      <div className="flex flex-col h-full">
        <div className="@container flex-1 overflow-y-auto pb-32">
          <div className="max-w-[1000px] mx-auto px-4 @max-[560px]:px-1 mt-10 mb-[70vh]">
            {messages.length === 0 && <EmptyChat handleSubmit={handleSubmit} />}
            {messages && (
              <MessageContent
                messages={messages}
                chatSettings={chatSettings}
                handleBranch={handleBranch}
                handleDelete={handleDelete}
                handleRetry={handleRetry}
                handleEdit={handleEdit}
                isLoading={isLoading}
                streamingMessageId={streamingMessageId}
                selectedModel={selectedModel}
                modelsData={modelsData}
                speakingMessageId={speakingMessageId}
                toggleSpeakMessage={toggleSpeakMessage}
              />
            )}

            <div ref={messagesEndRef} className="mt-24" />
          </div>
        </div>

        <ChatInput
          ref={chatInputRef}
          onSubmit={handleSubmit}
          onStop={onStop}
          isLoading={isLoading}
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
          modelsData={modelsData}
          modelsLoading={modelsLoading}
          modelsError={modelsError}
          apiKeyInfo={apiKeyInfo?.data}
          ttsEnabled={chatSettings.ttsEnabled}
          onTtsToggle={updateTtsEnabled}
          selectedVoice={chatSettings.selectedVoice}
          onVoiceChange={updateSelectedVoice}
          onSystemPromptEdit={handleSystemPromptEdit}
          onToolsClick={() => setShowToolManager(true)}
        />

        <ToolManager open={showToolManager} onOpenChange={setShowToolManager} />
      </div>
    </>
  );
}
