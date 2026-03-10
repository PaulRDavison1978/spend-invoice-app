import React from 'react'
import ReactDOM from 'react-dom/client'
import { PublicClientApplication } from '@azure/msal-browser'
import { MsalProvider } from '@azure/msal-react'
import { msalConfig } from './authConfig.js'
import App from './App.jsx'
import './index.css'

const msalInstance = new PublicClientApplication(msalConfig)

msalInstance.initialize().then(() => {
  // Handle redirect response before rendering (required for loginRedirect flow)
  return msalInstance.handleRedirectPromise()
}).then(() => {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <MsalProvider instance={msalInstance}>
        <App />
      </MsalProvider>
    </React.StrictMode>,
  )
})
