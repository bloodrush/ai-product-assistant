import PhaseIndicator from './components/PhaseIndicator.jsx'
import ChatWindow from './components/ChatWindow.jsx'
import ChatInput from './components/ChatInput.jsx'
import { useConversation } from './hooks/useConversation.js'
import './styles/main.css'

export default function App() {
  const { messages, isLoading, error, sendUserMessage } = useConversation()

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div className="logo">
            <span className="logo-mark">◆</span>
            <span className="logo-text">Discovery</span>
          </div>
          <PhaseIndicator currentPhase={1} />
        </div>
      </header>

      <main className="main">
        <ChatWindow
          messages={messages}
          isLoading={isLoading}
          error={error}
        />
      </main>

      <footer className="footer">
        <ChatInput onSend={sendUserMessage} isLoading={isLoading} />
      </footer>
    </div>
  )
}
