import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const require = createRequire(new URL('../../apps/app/package.json', import.meta.url));
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
function load(relative, mocks = {}) {
  const filename = fileURLToPath(new URL(`../../${relative}`, import.meta.url));
  const source = ts.transpileModule(readFileSync(filename,'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 } }).outputText;
  const module = { exports: {} };
  new Function('require','module','exports',source)(id => mocks[id] || require(id),module,module.exports);
  return module.exports;
}
function history(query) {
  const { CreditHistory } = load('apps/app/features/billing/components/CreditHistory.tsx', {
    '../queries': { useCreditHistory: () => ({ refetch() {}, ...query }) },
    '@blynta/ui': { AppButton: ({ children, ...props }) => React.createElement('button',props,children) },
  });
  return renderToStaticMarkup(React.createElement(CreditHistory));
}
test('insufficient credits communicates required, available, and supported upgrade route', () => {
  const { InsufficientCredits } = load('packages/ui/src/components/InsufficientCredits.tsx');
  const html = renderToStaticMarkup(React.createElement(InsufficientCredits,{required:18,available:5,billingUrl:'/billing'}));
  assert.match(html,/18 credits/); assert.match(html,/5 available/); assert.match(html,/href="\/billing"/); assert.match(html,/role="alert"/);
});
test('history distinguishes charges, holds and released holds', () => {
  const rows = ['reserve','charge','release','grant'].map((type,index) => ({ _id:String(index), type, product:'ai-clips', amount:5, availableDelta:5,
    description:'Video work', createdAt:'2026-10-08T00:00:00Z' }));
  const html = history({ data:{rows,page:1,totalPages:2} });
  assert.match(html,/5 held/); assert.match(html,/−5/); assert.match(html,/5 unlocked/); assert.match(html,/\+5/);
  assert.match(html,/not new credit grants/); assert.match(html,/Filter by product/); assert.match(html,/Page 1 of 2/);
});
test('history loading, failure, and empty states are accessible', () => {
  assert.match(history({isPending:true}),/role="status"/);
  assert.match(history({error:new Error('Unavailable')}),/Could not load credit history/);
  assert.match(history({data:{rows:[],totalPages:0}}),/No transactions match/);
});

test('submission clearly reports inactive usage billing without advertising a flat rate', () => {
  const component = ({children,disabled}) => React.createElement('div',{'data-disabled':disabled},children);
  const icons = new Proxy({}, { get: () => () => null });
  const { HeroInput } = load('apps/app/features/dashboard/components/HeroInput.tsx', {
    '@/features/jobs': { SourcePlatform:{YOUTUBE:'youtube'}, useStylePresets:()=>({data:[]}),useCreateJob:()=>({mutate(){},reset(){},isPending:false}) },
    '@/features/auth/queries':{useCurrentUser:()=>({data:{plan:'free'}})},
    '@/features/billing/queries':{useCreditBalance:()=>({data:{enabled:false,available:20}})},
    '@/config/axiosClient':{axiosClient:{}}, '@/lib/utils':{cn:(...args)=>args.join(' ')},
    '../icons':icons, '@blynta/ui':new Proxy({}, {get:()=>component}),
    'next/link':{default:component},'next/navigation':{useRouter:()=>({push(){}})},'sonner':{toast:{}}
  });
  const html = renderToStaticMarkup(React.createElement(HeroInput));
  assert.doesNotMatch(html,/1 credit per job|1 credit per video/);
  assert.match(html,/New processing is temporarily unavailable/);
});
