'use client';
import {createContext,useCallback,useContext,useEffect,useMemo,useState,type ReactNode} from 'react';
import {translateMessage} from './i18n-messages.mjs';

export type Language='zh'|'en';
export const LANGUAGE_KEY='qtc-market.language';
type Values=Record<string,string|number>;
const format=(text:string,values:Values={})=>text.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g,(match,key)=>Object.hasOwn(values,key)?String(values[key]):match);
type I18n={language:Language;locale:'zh-CN'|'en-US';setLanguage:(language:Language)=>void;t:(zh:string,en:string,values?:Values)=>string;error:(message:string)=>string};
const Context=createContext<I18n>({language:'zh',locale:'zh-CN',setLanguage:()=>{},t:(zh,_en,values)=>format(zh,values),error:message=>message});
export function LanguageProvider({children}:{children:ReactNode}){
 const [language,setCurrent]=useState<Language>('zh');
 useEffect(()=>{
  try{const saved=localStorage.getItem(LANGUAGE_KEY);if(saved==='en'||saved==='zh')setCurrent(saved)}catch{}
  const sync=(event:StorageEvent)=>{if(event.key===LANGUAGE_KEY||event.key===null)setCurrent(event.newValue==='en'?'en':'zh')};
  window.addEventListener('storage',sync);return()=>window.removeEventListener('storage',sync);
 },[]);
 const setLanguage=useCallback((next:Language)=>{setCurrent(next);try{localStorage.setItem(LANGUAGE_KEY,next)}catch{}},[]);
 useEffect(()=>{document.documentElement.lang=language==='en'?'en':'zh-CN'},[language]);
 const t=useCallback((zh:string,en:string,values?:Values)=>format(language==='en'?en:zh,values),[language]);
 const error=useCallback((message:string)=>translateMessage(message,language),[language]);
 const value=useMemo<I18n>(()=>({language,locale:language==='en'?'en-US':'zh-CN',setLanguage,t,error}),[language,setLanguage,t,error]);
 return <Context.Provider value={value}>{children}</Context.Provider>;
}
export const useI18n=()=>useContext(Context);
