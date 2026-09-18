import * as parser from '@babel/parser';
import traversePkg from '@babel/traverse';
import * as fs from 'fs';
import * as path from 'path';
import { GraphNode } from '../../graph-builder/src/types';

const traverse = (traversePkg as any).default || traversePkg;

export interface ApiClientMethodMapping {
  methodName: string;
  httpMethod: string;
  urlPattern: string; // e.g. "/api/users/:id"
  rawTemplate?: string;
  file: string;
  line: number;
}

export interface FrontendCallSite {
  callerComponent: string;
  callType: 'fetch' | 'axios' | 'api-client' | 'custom-hook';
  expression: string;
  httpMethod: string;
  urlLiteral?: string;
  urlTemplate?: string;
  normalizedPattern: string; // e.g. "/api/users/:id"
  file: string;
  line: number;
  isTryCatchGuarded: boolean;
  destructuredFields: string[];
  notes?: string;
}

export interface FrontendComponentInfo {
  name: string;
  file: string;
  line: number;
  endLine?: number;
  callSites: FrontendCallSite[];
  subComponentsUsed: string[];
  destructuredFieldsAcrossComponent: string[];
  hasErrorHandling: boolean;
  codeSnippet?: string;
}

export interface FrontendScanResult {
  components: FrontendComponentInfo[];
  apiClientMappings: ApiClientMethodMapping[];
  nodes: GraphNode[];
}

export class FrontendScanner {
  public scanDirectory(frontendDir: string): FrontendScanResult {
    const components: FrontendComponentInfo[] = [];
    const apiClientMappings: ApiClientMethodMapping[] = [];

    const files = this.getAllFiles(frontendDir).filter(
      f => f.endsWith('.tsx') || f.endsWith('.jsx') || f.endsWith('.ts') || f.endsWith('.js')
    );

    // 1. First scan for API client definition files (e.g. api-client.ts, api.ts, services/)
    for (const file of files) {
      if (file.includes('api-client') || file.includes('api.ts') || file.includes('client.ts') || file.includes('endpoints')) {
        const mappings = this.scanApiClientFile(file);
        apiClientMappings.push(...mappings);
      }
    }

    // 2. Scan React Component files
    for (const file of files) {
      // Exclude pure client definition from components
      if (!file.includes('api-client') && (file.endsWith('.tsx') || file.endsWith('.jsx') || file.includes('Component') || file.includes('Dashboard') || file.includes('Profile') || file.includes('Button') || file.includes('Summary') || file.includes('View'))) {
        const fileComponents = this.scanComponentFile(file, apiClientMappings);
        components.push(...fileComponents);
      }
    }

    // Convert into GraphNodes
    const nodes: GraphNode[] = [];
    for (const comp of components) {
      nodes.push({
        id: `component:${comp.name}`,
        name: comp.name,
        label: `<${comp.name} />`,
        type: 'component',
        file: comp.file,
        line: comp.line,
        endLine: comp.endLine,
        hasTryCatch: comp.hasErrorHandling,
        codeSnippet: comp.codeSnippet,
        metadata: {
          subComponents: comp.subComponentsUsed,
          callSitesCount: comp.callSites.length,
          destructuredFields: comp.destructuredFieldsAcrossComponent
        }
      });
    }

    return {
      components,
      apiClientMappings,
      nodes
    };
  }

  public scanApiClientFile(filePath: string): ApiClientMethodMapping[] {
    const code = fs.readFileSync(filePath, 'utf-8');
    const mappings: ApiClientMethodMapping[] = [];

    let ast: parser.ParseResult<parser.File>;
    try {
      ast = parser.parse(code, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx']
      });
    } catch (e) {
      return mappings;
    }

    traverse(ast, {
      ObjectProperty: (propPath: any) => {
        const key = propPath.node.key?.name || propPath.node.key?.value;
        const value = propPath.node.value;

        if (key && (value.type === 'ArrowFunctionExpression' || value.type === 'FunctionExpression')) {
          const mapping = this.extractFetchFromFunction(value, filePath, key);
          if (mapping) {
            mappings.push(mapping);
          }
        }
      },
      ObjectMethod: (methodPath: any) => {
        const key = methodPath.node.key?.name || methodPath.node.key?.value;
        if (key) {
          const mapping = this.extractFetchFromFunction(methodPath.node, filePath, key);
          if (mapping) {
            mappings.push(mapping);
          }
        }
      }
    });

    return mappings;
  }

  private extractFetchFromFunction(funcNode: any, file: string, methodName: string): ApiClientMethodMapping | null {
    let mapping: ApiClientMethodMapping | null = null;

    traverse(funcNode, {
      noScope: true,
      CallExpression: (callPath: any) => {
        const callee = callPath.node.callee;
        // Direct fetch
        if (callee.type === 'Identifier' && callee.name === 'fetch') {
          const args = callPath.node.arguments;
          let httpMethod = 'GET';
          let urlPattern = '';
          let rawTemplate = '';

          // Check options argument for method
          if (args[1] && args[1].type === 'ObjectExpression') {
            for (const prop of args[1].properties) {
              if (prop.type === 'ObjectProperty' && prop.key?.name === 'method') {
                if (prop.value?.type === 'StringLiteral') {
                  httpMethod = prop.value.value.toUpperCase();
                }
              }
            }
          }

          if (args[0]) {
            if (args[0].type === 'StringLiteral') {
              urlPattern = args[0].value;
              rawTemplate = args[0].value;
            } else if (args[0].type === 'TemplateLiteral') {
              rawTemplate = args[0].quasis.map((q: any) => q.value.raw).join('${var}');
              urlPattern = this.normalizeTemplateToPattern(args[0]);
            }
          }

          mapping = {
            methodName,
            httpMethod,
            urlPattern,
            rawTemplate,
            file,
            line: callPath.node.loc?.start.line || 1
          };
        }
      }
    });

    return mapping;
  }

  private scanComponentFile(filePath: string, apiClientMappings: ApiClientMethodMapping[]): FrontendComponentInfo[] {
    const code = fs.readFileSync(filePath, 'utf-8');
    const lines = code.split('\n');
    const components: FrontendComponentInfo[] = [];

    let ast: parser.ParseResult<parser.File>;
    try {
      ast = parser.parse(code, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx']
      });
    } catch (e) {
      return components;
    }

    traverse(ast, {
      // Function Component: export const UserProfile: React.FC = ... or function UserProfile()
      VariableDeclarator: (varPath: any) => {
        const id = varPath.node.id;
        const init = varPath.node.init;
        const name = id?.name;

        if (name && /^[A-Z]/.test(name) && init && (init.type === 'ArrowFunctionExpression' || init.type === 'FunctionExpression')) {
          const comp = this.analyzeComponentNode(name, init, filePath, lines, apiClientMappings);
          components.push(comp);
        }
      },
      FunctionDeclaration: (funcPath: any) => {
        const name = funcPath.node.id?.name;
        if (name && /^[A-Z]/.test(name)) {
          const comp = this.analyzeComponentNode(name, funcPath.node, filePath, lines, apiClientMappings);
          components.push(comp);
        }
      },
      ClassDeclaration: (classPath: any) => {
        const name = classPath.node.id?.name;
        if (name && /^[A-Z]/.test(name)) {
          const comp = this.analyzeComponentNode(name, classPath.node, filePath, lines, apiClientMappings);
          components.push(comp);
        }
      }
    });

    return components;
  }

  private analyzeComponentNode(
    name: string,
    astNode: any,
    filePath: string,
    lines: string[],
    apiClientMappings: ApiClientMethodMapping[]
  ): FrontendComponentInfo {
    const callSites: FrontendCallSite[] = [];
    const subComponentsUsed = new Set<string>();
    const destructuredFields = new Set<string>();
    let hasErrorHandling = false;

    // Mapping of API client methods to easily resolve `api.getUser(...)`
    const clientMap = new Map<string, ApiClientMethodMapping>();
    for (const m of apiClientMappings) {
      clientMap.set(m.methodName, m);
    }

    // Traverse component body
    traverse(astNode, {
      noScope: true,
      JSXOpeningElement: (jsxPath: any) => {
        const tag = jsxPath.node.name;
        if (tag.type === 'JSXIdentifier' && /^[A-Z]/.test(tag.name) && tag.name !== name) {
          subComponentsUsed.add(tag.name);
        }
      },
      // Track Destructuring Assignments (e.g. const { userId: uid, email, role } = data)
      VariableDeclarator: (varPath: any) => {
        const id = varPath.node.id;
        if (id && id.type === 'ObjectPattern') {
          for (const prop of id.properties) {
            if (prop.type === 'ObjectProperty' && prop.key?.name) {
              destructuredFields.add(prop.key.name);
            }
          }
        }
      },
      // Track Member Access (e.g. user.profile.displayName, order.totalAmount)
      MemberExpression: (memPath: any) => {
        const obj = memPath.node.object;
        const prop = memPath.node.property;
        if (obj.type === 'Identifier' && (obj.name === 'user' || obj.name === 'order' || obj.name === 'data' || obj.name === 'item')) {
          if (prop.type === 'Identifier') {
            destructuredFields.add(prop.name);
          }
        }
      },
      // Track Call Expressions (fetch, axios, api.<method>)
      CallExpression: (callPath: any) => {
        const callee = callPath.node.callee;
        const callLine = callPath.node.loc?.start.line || 1;
        const expressionText = lines[callLine - 1]?.trim() || 'api_call';

        // Check if enclosed in try/catch or has .catch()
        const isTryCatchGuarded = this.checkIsTryCatchGuarded(callPath);
        if (isTryCatchGuarded) {
          hasErrorHandling = true;
        }

        // 1. Direct fetch call: fetch('/api/users') or fetch(`/api/users/${id}`)
        if (callee.type === 'Identifier' && callee.name === 'fetch') {
          const args = callPath.node.arguments;
          let httpMethod = 'GET';
          let urlLiteral: string | undefined;
          let urlTemplate: string | undefined;
          let normalizedPattern = '';

          if (args[1] && args[1].type === 'ObjectExpression') {
            for (const p of args[1].properties) {
              if (p.type === 'ObjectProperty' && p.key?.name === 'method' && p.value?.type === 'StringLiteral') {
                httpMethod = p.value.value.toUpperCase();
              }
            }
          }

          if (args[0]) {
            if (args[0].type === 'StringLiteral') {
              urlLiteral = args[0].value;
              normalizedPattern = args[0].value;
            } else if (args[0].type === 'TemplateLiteral') {
              urlTemplate = args[0].quasis.map((q: any) => q.value.raw).join('${var}');
              normalizedPattern = this.normalizeTemplateToPattern(args[0]);
            }
          }

          callSites.push({
            callerComponent: name,
            callType: 'fetch',
            expression: expressionText,
            httpMethod,
            urlLiteral,
            urlTemplate,
            normalizedPattern,
            file: filePath,
            line: callLine,
            isTryCatchGuarded,
            destructuredFields: Array.from(destructuredFields)
          });
        }
        // 2. Shared API Client Call: api.getUser(id) or api.listUsers()
        else if (callee.type === 'MemberExpression') {
          const objName = callee.object?.name;
          const propName = callee.property?.name;

          if (objName === 'api' && propName) {
            const mapped = clientMap.get(propName);
            if (mapped) {
              callSites.push({
                callerComponent: name,
                callType: 'api-client',
                expression: `api.${propName}()`,
                httpMethod: mapped.httpMethod,
                urlLiteral: mapped.rawTemplate,
                urlTemplate: mapped.rawTemplate,
                normalizedPattern: mapped.urlPattern,
                file: filePath,
                line: callLine,
                isTryCatchGuarded,
                destructuredFields: Array.from(destructuredFields),
                notes: `Resolved via api-client wrapper: ${mapped.file}:${mapped.line}`
              });
            } else {
              // Heuristic fallback
              const inferredMethod = propName.startsWith('checkout') || propName.startsWith('create') || propName.startsWith('post') ? 'POST' : 'GET';
              callSites.push({
                callerComponent: name,
                callType: 'api-client',
                expression: `api.${propName}()`,
                httpMethod: inferredMethod,
                normalizedPattern: `/api/${propName.toLowerCase().replace('get', '').replace('list', '')}`,
                file: filePath,
                line: callLine,
                isTryCatchGuarded,
                destructuredFields: Array.from(destructuredFields)
              });
            }
          }
        }
      }
    }, (astNode.scope as any) || {});

    const loc = astNode.loc;
    const codeSnippet = loc ? lines.slice(loc.start.line - 1, Math.min(loc.start.line + 25, loc.end.line)).join('\n') : '';

    return {
      name,
      file: filePath,
      line: loc?.start.line || 1,
      endLine: loc?.end.line,
      callSites,
      subComponentsUsed: Array.from(subComponentsUsed),
      destructuredFieldsAcrossComponent: Array.from(destructuredFields),
      hasErrorHandling,
      codeSnippet
    };
  }

  private checkIsTryCatchGuarded(callPath: any): boolean {
    let current = callPath;
    while (current) {
      if (current.isTryStatement && current.isTryStatement()) {
        return true;
      }
      if (current.isCatchClause && current.isCatchClause()) {
        return true;
      }
      // Check for .catch(...) promise chained
      if (current.parentPath && current.parentPath.node && current.parentPath.node.type === 'MemberExpression') {
        if (current.parentPath.node.property?.name === 'catch') {
          return true;
        }
      }
      current = current.parentPath;
    }
    return false;
  }

  private normalizeTemplateToPattern(templateNode: any): string {
    const quasis = templateNode.quasis || [];
    let pattern = '';
    for (let i = 0; i < quasis.length; i++) {
      pattern += quasis[i].value.raw;
      if (i < quasis.length - 1) {
        pattern += ':param';
      }
    }
    return pattern;
  }

  private getAllFiles(dir: string): string[] {
    let results: string[] = [];
    if (!fs.existsSync(dir)) return results;
    const list = fs.readdirSync(dir);
    for (const file of list) {
      if (file === 'node_modules' || file === 'dist' || file === '.git') continue;
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat && stat.isDirectory()) {
        results = results.concat(this.getAllFiles(fullPath));
      } else {
        results.push(fullPath);
      }
    }
    return results;
  }
}
