import nextra from 'nextra'
 
// Set up Nextra with its configuration
const withNextra = nextra({
  defaultShowCopyCode: true,
})
 
// Export the final Next.js config with Nextra included
export default withNextra({
  turbopack: {
    root: import.meta.dirname,
  },
})