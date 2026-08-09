import { Routes, Route, Navigate } from "react-router";
import StartMenu from "./pages/StartMenu";
import WorldView from "./pages/WorldView";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<StartMenu />} />
      <Route path="/world/:worldId" element={<WorldView />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
