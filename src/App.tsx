import { lazy, Suspense, useEffect } from 'react';
import { Link, Route, Routes, useNavigate } from 'react-router-dom';
import { Spinner } from './components/ui';
import { useAuth } from './contexts/AuthContext';
import AppLayout from './layouts/AppLayout';
import DashboardPage from './features/dashboard/DashboardPage';
import PracticeSetupPage from './features/practice/PracticeSetupPage';
import PracticeRunPage from './features/practice/PracticeRunPage';
import ExamSetupPage from './features/exam/ExamSetupPage';
import ExamRunPage from './features/exam/ExamRunPage';
import ResultPage from './features/results/ResultPage';
import WrongQuestionsPage from './features/wrong-questions/WrongQuestionsPage';
import BookmarksPage from './features/bookmarks/BookmarksPage';
import { LoginPage, RegisterPage, ForgotPasswordPage, ResetPasswordPage } from './features/auth/AuthPages';
import ProfilePage from './features/auth/ProfilePage';

const HistoryPage = lazy(() => import('./features/statistics/HistoryPage'));

function NotFound() {
  return (
    <div className="py-20 text-center">
      <h1 className="text-3xl">找不到這個頁面</h1>
      <Link to="/" className="btn-primary mt-6">回到首頁</Link>
    </div>
  );
}

export default function App() {
  const { recovering } = useAuth();
  const navigate = useNavigate();
  // 從「重設密碼」信件回來後，導向重設頁
  useEffect(() => {
    if (recovering) navigate('/reset-password', { replace: true });
  }, [recovering, navigate]);

  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="practice" element={<PracticeSetupPage />} />
          <Route path="practice/run" element={<PracticeRunPage />} />
          <Route path="exam" element={<ExamSetupPage />} />
          <Route path="exam/run" element={<ExamRunPage />} />
          <Route path="result/:id" element={<ResultPage />} />
          <Route path="wrong" element={<WrongQuestionsPage />} />
          <Route path="bookmarks" element={<BookmarksPage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
          <Route path="forgot-password" element={<ForgotPasswordPage />} />
          <Route path="reset-password" element={<ResetPasswordPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
