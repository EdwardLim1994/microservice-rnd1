import type { GraphQLResolveInfo } from 'graphql';
import type { EmployeeContextType } from './context';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type RequireFields<T, K extends keyof T> = Omit<T, K> & { [P in K]-?: NonNullable<T[P]> };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  _FieldSet: { input: unknown; output: unknown; }
};

export type AssignSupervisorInput = {
  employeeId: Scalars['ID']['input'];
  supervisorId: Scalars['ID']['input'];
};

export type Employee = {
  __typename?: 'Employee';
  createdAt: Scalars['String']['output'];
  department: Scalars['String']['output'];
  employeeId: Scalars['String']['output'];
  fullName: Scalars['String']['output'];
  grossSalary: Scalars['Float']['output'];
  id: Scalars['ID']['output'];
  role: Scalars['String']['output'];
  supervisor?: Maybe<Employee>;
};

export type Mutation = {
  __typename?: 'Mutation';
  assignSupervisor: Employee;
  registerEmployee: RegisterEmployeeResult;
};


export type MutationAssignSupervisorArgs = {
  input: AssignSupervisorInput;
};


export type MutationRegisterEmployeeArgs = {
  input: RegisterEmployeeInput;
};

export type Query = {
  __typename?: 'Query';
  employee?: Maybe<Employee>;
  employees: Array<Employee>;
};


export type QueryEmployeeArgs = {
  id: Scalars['ID']['input'];
};


export type QueryEmployeesArgs = {
  department?: InputMaybe<Scalars['String']['input']>;
  role?: InputMaybe<Scalars['String']['input']>;
};

export type RegisterEmployeeInput = {
  department: Scalars['String']['input'];
  employeeId: Scalars['String']['input'];
  fullName: Scalars['String']['input'];
  grossSalary: Scalars['Float']['input'];
  role: Scalars['String']['input'];
  supervisorId?: InputMaybe<Scalars['ID']['input']>;
};

export type RegisterEmployeeResult = {
  __typename?: 'RegisterEmployeeResult';
  employee: Employee;
  temporaryPassword: Scalars['String']['output'];
};

export type WithIndex<TObject> = TObject & Record<string, any>;
export type ResolversObject<TObject> = WithIndex<TObject>;

export type ResolverTypeWrapper<T> = Promise<T> | T;

export type ReferenceResolver<TResult, TReference, TContext> = (
      reference: TReference,
      context: TContext,
      info: GraphQLResolveInfo
    ) => Promise<TResult> | TResult;

      type ScalarCheck<T, S> = S extends true ? T : NullableCheck<T, S>;
      type NullableCheck<T, S> = Maybe<T> extends T ? Maybe<ListCheck<NonNullable<T>, S>> : ListCheck<T, S>;
      type ListCheck<T, S> = T extends (infer U)[] ? NullableCheck<U, S>[] : GraphQLRecursivePick<T, S>;
      export type GraphQLRecursivePick<T, S> = { [K in keyof T & keyof S]: ScalarCheck<T[K], S[K]> };
    

export type ResolverWithResolve<TResult, TParent, TContext, TArgs> = {
  resolve: ResolverFn<TResult, TParent, TContext, TArgs>;
};
export type Resolver<TResult, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>, TArgs = Record<PropertyKey, never>> = ResolverFn<TResult, TParent, TContext, TArgs> | ResolverWithResolve<TResult, TParent, TContext, TArgs>;

export type ResolverFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => Promise<TResult> | TResult;

export type SubscriptionSubscribeFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => AsyncIterable<TResult> | Promise<AsyncIterable<TResult>>;

export type SubscriptionResolveFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;

export interface SubscriptionSubscriberObject<TResult, TKey extends string, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<{ [key in TKey]: TResult }, TParent, TContext, TArgs>;
  resolve?: SubscriptionResolveFn<TResult, { [key in TKey]: TResult }, TContext, TArgs>;
}

export interface SubscriptionResolverObject<TResult, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<any, TParent, TContext, TArgs>;
  resolve: SubscriptionResolveFn<TResult, any, TContext, TArgs>;
}

export type SubscriptionObject<TResult, TKey extends string, TParent, TContext, TArgs> =
  | SubscriptionSubscriberObject<TResult, TKey, TParent, TContext, TArgs>
  | SubscriptionResolverObject<TResult, TParent, TContext, TArgs>;

export type SubscriptionResolver<TResult, TKey extends string, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>, TArgs = Record<PropertyKey, never>> =
  | ((...args: any[]) => SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>)
  | SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>;

export type TypeResolveFn<TTypes, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>> = (
  parent: TParent,
  context: TContext,
  info: GraphQLResolveInfo
) => Maybe<TTypes> | Promise<Maybe<TTypes>>;

export type IsTypeOfResolverFn<T = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>> = (obj: T, context: TContext, info: GraphQLResolveInfo) => boolean | Promise<boolean>;

export type NextResolverFn<T> = () => Promise<T>;

export type DirectiveResolverFn<TResult = Record<PropertyKey, never>, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>, TArgs = Record<PropertyKey, never>> = (
  next: NextResolverFn<TResult>,
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;

/** Mapping of federation types */
export type FederationTypes = ResolversObject<{
  Employee: Employee;
}>;

/** Mapping of federation reference types */
export type FederationReferenceTypes = ResolversObject<{
  Employee:
    ( { __typename: 'Employee' }
    & GraphQLRecursivePick<FederationTypes['Employee'], {"id":true}> );
}>;



/** Mapping between all available schema types and the resolvers types */
export type ResolversTypes = ResolversObject<{
  AssignSupervisorInput: AssignSupervisorInput;
  ID: ResolverTypeWrapper<Scalars['ID']['output']>;
  Employee: ResolverTypeWrapper<Employee>;
  String: ResolverTypeWrapper<Scalars['String']['output']>;
  Float: ResolverTypeWrapper<Scalars['Float']['output']>;
  Mutation: ResolverTypeWrapper<Record<PropertyKey, never>>;
  Query: ResolverTypeWrapper<Record<PropertyKey, never>>;
  RegisterEmployeeInput: RegisterEmployeeInput;
  RegisterEmployeeResult: ResolverTypeWrapper<RegisterEmployeeResult>;
  Boolean: ResolverTypeWrapper<Scalars['Boolean']['output']>;
}>;

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = ResolversObject<{
  AssignSupervisorInput: AssignSupervisorInput;
  ID: Scalars['ID']['output'];
  Employee: Employee | FederationReferenceTypes['Employee'];
  String: Scalars['String']['output'];
  Float: Scalars['Float']['output'];
  Mutation: Record<PropertyKey, never>;
  Query: Record<PropertyKey, never>;
  RegisterEmployeeInput: RegisterEmployeeInput;
  RegisterEmployeeResult: RegisterEmployeeResult;
  Boolean: Scalars['Boolean']['output'];
}>;

export type EmployeeResolvers<ContextType = EmployeeContextType, ParentType extends ResolversParentTypes['Employee'] = ResolversParentTypes['Employee'], FederationReferenceType extends FederationReferenceTypes['Employee'] = FederationReferenceTypes['Employee']> = ResolversObject<{
  __resolveReference?: ReferenceResolver<Maybe<ResolversTypes['Employee']> | FederationReferenceType, FederationReferenceType, ContextType>;
  createdAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  department?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  employeeId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  fullName?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  grossSalary?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  role?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  supervisor?: Resolver<Maybe<ResolversTypes['Employee']>, ParentType, ContextType>;
}>;

export type MutationResolvers<ContextType = EmployeeContextType, ParentType extends ResolversParentTypes['Mutation'] = ResolversParentTypes['Mutation']> = ResolversObject<{
  assignSupervisor?: Resolver<ResolversTypes['Employee'], ParentType, ContextType, RequireFields<MutationAssignSupervisorArgs, 'input'>>;
  registerEmployee?: Resolver<ResolversTypes['RegisterEmployeeResult'], ParentType, ContextType, RequireFields<MutationRegisterEmployeeArgs, 'input'>>;
}>;

export type QueryResolvers<ContextType = EmployeeContextType, ParentType extends ResolversParentTypes['Query'] = ResolversParentTypes['Query']> = ResolversObject<{
  employee?: Resolver<Maybe<ResolversTypes['Employee']>, ParentType, ContextType, RequireFields<QueryEmployeeArgs, 'id'>>;
  employees?: Resolver<Array<ResolversTypes['Employee']>, ParentType, ContextType, Partial<QueryEmployeesArgs>>;
}>;

export type RegisterEmployeeResultResolvers<ContextType = EmployeeContextType, ParentType extends ResolversParentTypes['RegisterEmployeeResult'] = ResolversParentTypes['RegisterEmployeeResult']> = ResolversObject<{
  employee?: Resolver<ResolversTypes['Employee'], ParentType, ContextType>;
  temporaryPassword?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
}>;

export type Resolvers<ContextType = EmployeeContextType> = ResolversObject<{
  Employee?: EmployeeResolvers<ContextType>;
  Mutation?: MutationResolvers<ContextType>;
  Query?: QueryResolvers<ContextType>;
  RegisterEmployeeResult?: RegisterEmployeeResultResolvers<ContextType>;
}>;

