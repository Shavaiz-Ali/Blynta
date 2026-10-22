/* Isolated local verification only: production UI/checkout code, fixture wallet, real sandbox Paddle.
 * Does not mount an app route, alter auth, connect to MongoDB, or simulate verified payments.
 * node scripts/preview-billing.cjs [--sandbox-checkout]
 */
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const Module = require("node:module");
const app = path.resolve(__dirname, "..");
const root = path.resolve(app, "../..");
const output = path.join(root, ".test-results/billing-preview");
fs.mkdirSync(output, { recursive: true });
const backendRequire = Module.createRequire(
  path.join(root, "backend/package.json"),
);
const backendEnv = backendRequire("dotenv").parse(
  fs.readFileSync(path.join(root, "backend/.env")),
);
const publicEnv = backendRequire("dotenv").parse(
  fs.readFileSync(path.join(app, ".env.local")),
);
const smoke = process.argv.includes("--sandbox-checkout");
if (smoke && backendEnv.PADDLE_ENV !== "sandbox")
  throw new Error("This fixture only permits sandbox Paddle");
const write = (name, text) => {
  const filename = path.join(output, name);
  fs.writeFileSync(filename, text);
  return filename;
};
const loader = write(
  "loader.cjs",
  `module.exports=function(source){return require(${JSON.stringify(require.resolve("typescript"))}).transpileModule(source,{compilerOptions:{module:99,target:9,jsx:4,esModuleInterop:true}}).outputText}`,
);
const auth = write(
  "auth.ts",
  `import { useQuery } from '@tanstack/react-query'; export const userQueryKeys={me:()=>['user','me']}; export function useCurrentUser(){return useQuery({queryKey:userQueryKeys.me(),queryFn:async()=>({id:'local-fixture',plan:'free',name:'Local preview',creditsBalance:30})})}`,
);
const axios = write(
  "axios.ts",
  `async function request(url,method='GET',body){const response=await fetch('/api'+url,{method,headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const data=await response.json();if(!response.ok)throw new Error(data.message||'Request failed');return{data}}export const axiosClient={get:(url,options)=>request(url+(options?.params?'?'+new URLSearchParams(options.params):'')),post:(url,body)=>request(url,'POST',body)}`,
);
const navigation = write(
  "navigation.ts",
  `import {useMemo} from 'react';export const useSearchParams=()=>useMemo(()=>new URLSearchParams(window.location.search),[]);`,
);
const link = write(
  "link.tsx",
  `import React from 'react';export default function Link(props){return <a {...props}/>}`,
);
const entry = write(
  "entry.tsx",
  `import React from 'react';import{createRoot}from'react-dom/client';import{QueryClient,QueryClientProvider}from'@tanstack/react-query';import{ThemeProvider,useTheme}from'next-themes';import{Toaster}from'sonner';import{BillingPage}from'${path.join(app, "features/billing/components/BillingPage").replaceAll("\\", "/")}';import{PaddleProvider}from'${path.join(app, "features/billing/components/PaddleProvider").replaceAll("\\", "/")}';import{AppButton}from'@blynta/ui';const client=new QueryClient({defaultOptions:{queries:{retry:false}}});function Preview(){const{resolvedTheme,setTheme}=useTheme();return <><div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted px-4 py-2 text-xs"><span>Local UI fixture · real sandbox checkout${smoke ? " enabled" : " disabled"} · no database or wallet changes</span><AppButton size="sm" variant="outline" onClick={()=>setTheme(resolvedTheme==='dark'?'light':'dark')}>Switch theme</AppButton></div><PaddleProvider><BillingPage/></PaddleProvider><Toaster/></>}createRoot(document.getElementById('root')).render(<QueryClientProvider client={client}><ThemeProvider attribute="class" defaultTheme="light"><Preview/></ThemeProvider></QueryClientProvider>);`,
);

async function main() {
  const webpack = require("next/dist/compiled/webpack/webpack");
  await new Promise((resolve, reject) =>
    webpack.webpack(
      {
        mode: "development",
        devtool: false,
        entry,
        output: { path: output, filename: "bundle.js" },
        resolve: {
          extensions: [".tsx", ".ts", ".js"],
          modules: [
            path.join(app, "node_modules"),
            path.join(root, "node_modules"),
            "node_modules",
          ],
          alias: {
            "@/features/auth/queries": auth,
            "@/config/axiosClient": axios,
            "@": app,
            "@blynta/ui": path.join(root, "packages/ui/src/index.ts"),
            "next/navigation": navigation,
            "next/link": link,
          },
        },
        module: {
          rules: [{ test: /\.tsx?$/, exclude: /node_modules/, use: loader }],
        },
        plugins: [
          new webpack.webpack.DefinePlugin({
            "process.env.NODE_ENV": JSON.stringify("development"),
            "process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN": JSON.stringify(
              publicEnv.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN || "",
            ),
            "process.env.NEXT_PUBLIC_PADDLE_ENV": JSON.stringify("sandbox"),
          }),
        ],
      },
      (error, stats) =>
        error || stats.hasErrors()
          ? reject(
              new Error(
                error?.message || stats.toString({ all: false, errors: true }),
              ),
            )
          : resolve(),
    ),
  );
  const postcss = Module.createRequire(require.resolve("@tailwindcss/postcss"))(
    "postcss",
  );
  const css = await postcss([require("@tailwindcss/postcss")()]).process(
    fs.readFileSync(path.join(app, "app/globals.css"), "utf8"),
    { from: path.join(app, "app/globals.css") },
  );
  let service;
  if (smoke) {
    backendRequire("ts-node").register({
      project: path.join(root, "backend/tsconfig.json"),
      preferTsExts: true,
      transpileOnly: true,
      compilerOptions: {
        module: "CommonJS",
        moduleResolution: "node",
        resolvePackageJsonExports: false,
      },
    });
    const { BillingService } = backendRequire(
      path.join(root, "backend/src/billing/billing.service.ts"),
    );
    const { Paddle, Environment } = backendRequire("@paddle/paddle-node-sdk");
    const { ConfigService } = backendRequire("@nestjs/config");
    const paddle = new Paddle(backendEnv.PADDLE_API_KEY, {
      environment: Environment.sandbox,
    });
    const owner = { userId: "507f1f77bcf86cd799439099" };
    const customers = {
      findOne: async () => owner,
      findOneAndUpdate: async (filter, update) => {
        if (owner.checkoutLeaseUntil > new Date()) return null;
        Object.assign(owner, update.$set);
        return { ...owner };
      },
      updateOne: async (filter, update) => {
        if (filter.checkoutLeaseToken !== owner.checkoutLeaseToken)
          return { matchedCount: 0 };
        Object.assign(owner, update.$set);
        Object.keys(update.$unset || {}).forEach((key) => delete owner[key]);
        return { matchedCount: 1 };
      },
    };
    service = new BillingService(
      {
        paddle,
        environment: "sandbox",
        getPriceIdForPlan: (plan) =>
          backendEnv["PADDLE_PRICE_ID_" + plan.toUpperCase()],
        mapPriceIdToPlan: () => null,
      },
      new ConfigService(backendEnv),
      {},
      {},
      {},
      {},
      customers,
      {},
      {},
      { enabled: true, entries: { exists: async () => false } },
    );
    service.getOrCreatePaddleCustomer = async () => {
      if (!owner.paddleCustomerId) {
        const email = "billing-verification@example.test";
        const matches = await paddle.customers.list({ email: [email] }).next();
        const created =
          matches[0] ||
          (await paddle.customers.create({
            email,
            name: "Local sandbox verification",
          }));
        owner.paddleCustomerId = created.id;
      }
      return owner.paddleCustomerId;
    };
    await service.getOrCreatePaddleCustomer();
  }
  const wallet = {
    enabled: true,
    available: 30,
    reserved: 0,
    plan: "free",
    monthlyCredits: 0,
    planAllocations: { free: 30, pro: 50, business: 200 },
    pricing: {
      version: "2026-10-v1",
      sourceSeconds: 300,
      outputSeconds: 60,
      studioSeconds: 60,
      studioModifier: 1,
      aiCredits: 1,
    },
    clipExample: { sourceCredits: 6, renderCredits: 3, totalCredits: 9 },
  };
  http
    .createServer(async (req, res) => {
      const url = new URL(req.url, "http://localhost");
      if (url.pathname === "/bundle.js") {
        res.setHeader("Content-Type", "text/javascript; charset=utf-8");
        return res.end(fs.readFileSync(path.join(output, "bundle.js")));
      }
      if (url.pathname === "/style.css") {
        res.setHeader("Content-Type", "text/css");
        return res.end(css.css);
      }
      if (!url.pathname.startsWith("/api/")) {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        return res.end(
          '<!doctype html><html><head><meta charset="utf-8"><title>Blynta billing verification</title><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body class="bg-background text-foreground"><div id="root"></div><script src="/bundle.js"></script></body></html>',
        );
      }
      res.setHeader("Content-Type", "application/json");
      try {
        const route = url.pathname.slice(4);
        let data;
        if (route === "/billing/credits") data = wallet;
        else if (route === "/billing/checkout-config")
          data = { environment: "sandbox" };
        else if (route === "/billing/credit-packs")
          data = [25, 50, 100].map((credits) => ({
            id: String(credits),
            credits,
            enabled: false,
            configurationError: "Missing PADDLE_PRICE_ID_CREDITS_" + credits,
          }));
        else if (route === "/billing/credits/history") {
          const page = Number(url.searchParams.get("page") || 1);
          data = {
            rows: [
              {
                _id: String(page),
                product: "account",
                type: "grant",
                amount: 30,
                availableDelta: 30,
                reservedDelta: 0,
                description: "One-time Free credits · local visual fixture",
                createdAt: "2026-10-22T10:00:00Z",
                operationId: "fixture",
              },
            ],
            total: 21,
            page,
            totalPages: 2,
          };
        } else if (route === "/billing/checkout-session" && service) {
          let body = "";
          for await (const chunk of req) body += chunk;
          const plan = JSON.parse(body).plan;
          if (!["pro", "business"].includes(plan))
            throw new Error("Invalid plan");
          data = await service.createCheckoutSession(
            { _id: "507f1f77bcf86cd799439099", plan: "free" },
            { plan },
          );
        } else if (route.startsWith("/billing/checkout-status/") && service)
          data = await service.checkoutStatus(
            "507f1f77bcf86cd799439099",
            route.split("/").at(-1),
          );
        else
          throw new Error(
            "This action is unavailable in the isolated local fixture",
          );
        res.end(JSON.stringify(data));
      } catch (error) {
        res.statusCode = 400;
        res.end(
          JSON.stringify({
            message:
              error instanceof Error ? error.message : "Sandbox request failed",
          }),
        );
      }
    })
    .listen(4320, "127.0.0.1", () =>
      console.log("Billing UI verification: http://127.0.0.1:4320/billing"),
    );
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
