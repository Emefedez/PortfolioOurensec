import react from '@vitejs/plugin-react'
import {defineConfig} from 'vite'
import { viteSingleFile } from "vite-plugin-singlefile"

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), viteSingleFile()],
	base : './', // Important for relative paths if deployed in a subdir
})
