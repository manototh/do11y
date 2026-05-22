import { Footer, Layout, Navbar } from 'nextra-theme-docs'
import { Banner, Head } from 'nextra/components'
import { getPageMap } from 'nextra/page-map'
import 'nextra-theme-docs/style.css'
 
export const metadata = {
  icons: {
    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>',
  },
}
 
const banner = <Banner storageKey="some-key">Nextra 4.0 is released 🎉</Banner>
const navbar = (
  <Navbar
    logo={<b>Nextra</b>}
    // ... Your additional navbar options
  />
)
const footer = <Footer>MIT {new Date().getFullYear()} © Nextra.</Footer>
 
export default async function RootLayout({ children }) {
  return (
    <html
      // Not required, but good for SEO
      lang="en"
      // Required to be set
      dir="ltr"
      // Suggested by `next-themes` package https://github.com/pacocoursey/next-themes#with-app
      suppressHydrationWarning
    >
      <Head>
        <meta name="axiom-do11y-domain" content="us-east-1.aws.edge.axiom.co" />
        <meta name="axiom-do11y-token" content="xaat-8c763b42-88a2-4474-a776-8f534d9fd82b" />
        <meta name="axiom-do11y-dataset" content="mano-do11y-test" />
        <meta name="axiom-do11y-framework" content="nextra" />
        <script src="/do11y.js" defer />
      </Head>
      <body>
        <Layout
          banner={banner}
          navbar={navbar}
          pageMap={await getPageMap()}
          docsRepositoryBase="https://github.com/shuding/nextra/tree/main/docs"
          footer={footer}
          // ... Your additional layout options
        >
          {children}
        </Layout>
      </body>
    </html>
  )
}