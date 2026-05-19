import { Suspense } from "react";
import { lazyRetry } from "./lib/lazy-retry";
import { BrowserRouter, Routes, Route, Navigate, Outlet, useParams } from "react-router-dom";
import { Layout } from "./components/Layout";
import { SessionProvider, useSession } from "./context/SessionContext";
import { LandingPage } from "./pages/LandingPage";
import { CreatePage } from "./pages/CreatePage";
import { JoinPage } from "./pages/JoinPage";
import { getStoredSession } from "./lib/session-storage";
import { SoloProvider } from "./context/SoloContext";

const LobbyPage = lazyRetry(() =>
  import("./pages/LobbyPage").then((m) => ({ default: m.LobbyPage }))
);
const AssignPage = lazyRetry(() =>
  import("./pages/AssignPage").then((m) => ({ default: m.AssignPage }))
);
const CameraPage = lazyRetry(() =>
  import("./pages/CameraPage").then((m) => ({ default: m.CameraPage }))
);
const CollagePage = lazyRetry(() =>
  import("./pages/CollagePage").then((m) => ({ default: m.CollagePage }))
);
const ExportPage = lazyRetry(() =>
  import("./pages/ExportPage").then((m) => ({ default: m.ExportPage }))
);
const SoloSetupPage = lazyRetry(() =>
  import("./pages/solo/SoloSetupPage").then((m) => ({ default: m.SoloSetupPage }))
);
const SoloCameraPage = lazyRetry(() =>
  import("./pages/solo/SoloCameraPage").then((m) => ({ default: m.SoloCameraPage }))
);
const SoloCollagePage = lazyRetry(() =>
  import("./pages/solo/SoloCollagePage").then((m) => ({ default: m.SoloCollagePage }))
);

function PartyShell({ children }: { children: React.ReactNode }) {
  const { reconnecting } = useSession();
  return <Layout reconnecting={reconnecting}>{children}</Layout>;
}

function PartyRoute({ children }: { children: React.ReactNode }) {
  const { code } = useParams<{ code: string }>();
  const stored = getStoredSession();

  if (!stored || !code) return <Navigate to="/join" replace />;

  if (stored.partyCode !== code.toUpperCase()) {
    return <Navigate to={`/party/${stored.partyCode}/lobby`} replace />;
  }

  return (
    <SessionProvider partyCode={code.toUpperCase()}>
      <PartyShell>{children}</PartyShell>
    </SessionProvider>
  );
}

function Loading() {
  return <p style={{ textAlign: "center", padding: 48 }}>Loading…</p>;
}

function SoloShell() {
  return (
    <SoloProvider>
      <Layout>
        <Suspense fallback={<Loading />}>
          <Outlet />
        </Suspense>
      </Layout>
    </SoloProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <Layout>
              <LandingPage />
            </Layout>
          }
        />
        <Route
          path="/create"
          element={
            <Layout>
              <CreatePage />
            </Layout>
          }
        />
        <Route
          path="/join"
          element={
            <Layout>
              <JoinPage />
            </Layout>
          }
        />
        <Route path="/solo" element={<SoloShell />}>
          <Route index element={<SoloSetupPage />} />
          <Route path="camera" element={<SoloCameraPage />} />
          <Route path="collage" element={<SoloCollagePage />} />
        </Route>
        <Route
          path="/party/:code/lobby"
          element={
            <PartyRoute>
              <Suspense fallback={<Loading />}>
                <LobbyPage />
              </Suspense>
            </PartyRoute>
          }
        />
        <Route
          path="/party/:code/assign"
          element={
            <PartyRoute>
              <Suspense fallback={<Loading />}>
                <AssignPage />
              </Suspense>
            </PartyRoute>
          }
        />
        <Route
          path="/party/:code/camera"
          element={
            <PartyRoute>
              <Suspense fallback={<Loading />}>
                <CameraPage />
              </Suspense>
            </PartyRoute>
          }
        />
        <Route
          path="/party/:code/collage"
          element={
            <PartyRoute>
              <Suspense fallback={<Loading />}>
                <CollagePage />
              </Suspense>
            </PartyRoute>
          }
        />
        <Route
          path="/party/:code/export"
          element={
            <PartyRoute>
              <Suspense fallback={<Loading />}>
                <ExportPage />
              </Suspense>
            </PartyRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
