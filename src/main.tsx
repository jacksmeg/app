import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { JhimsStoreProvider } from "./state/JhimsStore";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <JhimsStoreProvider>
      <App />
    </JhimsStoreProvider>
  </React.StrictMode>,
);
