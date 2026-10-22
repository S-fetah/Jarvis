import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App'
import { MascotApp } from './mascot/MascotApp'
import { QuickChatApp } from './quickchat/QuickChatApp'

const hash = window.location.hash.toLowerCase()

let RootComponent: React.ComponentType = App

if (hash.startsWith('#mascot')) {
  RootComponent = MascotApp
} else if (hash.startsWith('#quickchat')) {
  RootComponent = QuickChatApp
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <RootComponent />
  </React.StrictMode>
)
