import { lazy, Suspense } from 'react'
import { createBrowserRouter, Outlet, RouterProvider } from 'react-router'
import { StoreLayout } from './components/store/StoreLayout'
import { PageLoader } from './components/ui/misc'
import { ToastProvider } from './components/ui/Toast'
import { AuthProvider } from './contexts/AuthContext'
import { CartProvider } from './contexts/CartContext'
import { SettingsProvider } from './contexts/SettingsContext'
import NotFoundPage from './pages/NotFoundPage'
import RouteError from './pages/RouteError'
import HomePage from './pages/store/HomePage'
import ProductsPage from './pages/store/ProductsPage'

// Páginas menos acessadas e o painel inteiro são carregados sob demanda.
const ProductPage = lazy(() => import('./pages/store/ProductPage'))
const CartPage = lazy(() => import('./pages/store/CartPage'))
const PolicyPage = lazy(() => import('./pages/store/PolicyPage'))
const SignInPage = lazy(() => import('./pages/store/SignInPage'))
const AccountPage = lazy(() => import('./pages/store/AccountPage'))
const ResetPasswordPage = lazy(() => import('./pages/store/ResetPasswordPage'))
const AdminRoot = lazy(() => import('./pages/admin/AdminRoot'))
const LoginPage = lazy(() => import('./pages/admin/LoginPage'))
const DashboardPage = lazy(() => import('./pages/admin/DashboardPage'))
const ProductsListPage = lazy(() => import('./pages/admin/ProductsListPage'))
const ProductFormPage = lazy(() => import('./pages/admin/ProductFormPage'))
const CategoriesPage = lazy(() => import('./pages/admin/CategoriesPage'))
const BannersPage = lazy(() => import('./pages/admin/BannersPage'))
const SettingsPage = lazy(() => import('./pages/admin/SettingsPage'))
const OrdersPage = lazy(() => import('./pages/admin/OrdersPage'))
const OrderDetailPage = lazy(() => import('./pages/admin/OrderDetailPage'))
const ImportPage = lazy(() => import('./pages/admin/ImportPage'))

function Root() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Outlet />
    </Suspense>
  )
}

const router = createBrowserRouter([
  {
    element: <Root />,
    errorElement: <RouteError />,
    children: [
      {
        element: <StoreLayout />,
        children: [
          { index: true, element: <HomePage /> },
          { path: 'produtos', element: <ProductsPage /> },
          { path: 'produto/:slug', element: <ProductPage /> },
          { path: 'carrinho', element: <CartPage /> },
          { path: 'politicas/:tipo', element: <PolicyPage /> },
          { path: 'entrar', element: <SignInPage /> },
          { path: 'minha-conta', element: <AccountPage /> },
          { path: 'redefinir-senha', element: <ResetPasswordPage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
      { path: 'admin/login', element: <LoginPage /> },
      {
        path: 'admin',
        element: <AdminRoot />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'produtos', element: <ProductsListPage /> },
          { path: 'produtos/novo', element: <ProductFormPage /> },
          { path: 'produtos/:id', element: <ProductFormPage /> },
          { path: 'categorias', element: <CategoriesPage /> },
          { path: 'banners', element: <BannersPage /> },
          { path: 'pedidos', element: <OrdersPage /> },
          { path: 'pedidos/:id', element: <OrderDetailPage /> },
          { path: 'importar', element: <ImportPage /> },
          { path: 'configuracoes', element: <SettingsPage /> },
        ],
      },
    ],
  },
])

export default function App() {
  return (
    <SettingsProvider>
      <AuthProvider>
        <CartProvider>
          <ToastProvider>
            <RouterProvider router={router} />
          </ToastProvider>
        </CartProvider>
      </AuthProvider>
    </SettingsProvider>
  )
}
