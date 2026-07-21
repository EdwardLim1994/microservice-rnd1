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

/** An employee registered in the HR system, owned by the employee subgraph. */
export type Employee = {
  __typename?: 'Employee';
  /** ISO 8601 timestamp of when this Employee record was created. */
  createdAt: Scalars['String']['output'];
  /** Also used as the Authentik account's username. */
  email: Scalars['String']['output'];
  /** Given name. */
  firstName: Scalars['String']['output'];
  /** Free-text gender field, as supplied at registration. */
  gender: Scalars['String']['output'];
  /** Monthly gross salary, before deductions. */
  grossSalary: Scalars['Float']['output'];
  /** Unique internal identifier for the employee. */
  id: Scalars['ID']['output'];
  /** Family name. */
  lastName: Scalars['String']['output'];
  /** Per-day salary rate, used to compute unpaid-leave deductions (see FEAT-14). */
  salaryPerDay: Scalars['Float']['output'];
  /** This employee's supervisor record, resolved from supervisorId. Null if none is assigned. */
  supervisor?: Maybe<Employee>;
  /**
   * Id of this employee's supervisor, if assigned. Null until FEAT-3 (Assign supervisor) sets it,
   * or if never assigned.
   */
  supervisorId?: Maybe<Scalars['ID']['output']>;
  /** ISO 8601 timestamp of the last update to this Employee record. */
  updatedAt: Scalars['String']['output'];
};

export type Mutation = {
  __typename?: 'Mutation';
  /**
   * Creates an Employee record and a matching Authentik account (employee group,
   * mustChangePassword true). Rolls back the Employee record if Authentik account creation fails.
   */
  registerEmployee: RegisterEmployeeResult;
};


export type MutationRegisterEmployeeArgs = {
  input: RegisterEmployeeInput;
};

export type Query = {
  __typename?: 'Query';
  /** All registered employees, with each one's supervisor resolved via self-reference. */
  employees: Array<Employee>;
};

/** Input for registerEmployee — see the Employee type for field-level docs. */
export type RegisterEmployeeInput = {
  email: Scalars['String']['input'];
  firstName: Scalars['String']['input'];
  gender: Scalars['String']['input'];
  grossSalary: Scalars['Float']['input'];
  lastName: Scalars['String']['input'];
  salaryPerDay: Scalars['Float']['input'];
  /** Must reference an existing Employee's id, or the mutation returns NOT_FOUND. */
  supervisorId?: InputMaybe<Scalars['ID']['input']>;
};

/** Result of a successful registerEmployee call. */
export type RegisterEmployeeResult = {
  __typename?: 'RegisterEmployeeResult';
  /** The newly created Employee record. */
  employee: Employee;
  /**
   * One-time password for the created Authentik account (employee group,
   * mustChangePassword: true). Returned once — the caller is responsible for delivering it to the
   * employee; it cannot be retrieved again.
   */
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
  Employee: ResolverTypeWrapper<Employee>;
  String: ResolverTypeWrapper<Scalars['String']['output']>;
  Float: ResolverTypeWrapper<Scalars['Float']['output']>;
  ID: ResolverTypeWrapper<Scalars['ID']['output']>;
  Mutation: ResolverTypeWrapper<Record<PropertyKey, never>>;
  Query: ResolverTypeWrapper<Record<PropertyKey, never>>;
  RegisterEmployeeInput: RegisterEmployeeInput;
  RegisterEmployeeResult: ResolverTypeWrapper<RegisterEmployeeResult>;
  Boolean: ResolverTypeWrapper<Scalars['Boolean']['output']>;
}>;

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = ResolversObject<{
  Employee: Employee | FederationReferenceTypes['Employee'];
  String: Scalars['String']['output'];
  Float: Scalars['Float']['output'];
  ID: Scalars['ID']['output'];
  Mutation: Record<PropertyKey, never>;
  Query: Record<PropertyKey, never>;
  RegisterEmployeeInput: RegisterEmployeeInput;
  RegisterEmployeeResult: RegisterEmployeeResult;
  Boolean: Scalars['Boolean']['output'];
}>;

export type EmployeeResolvers<ContextType = EmployeeContextType, ParentType extends ResolversParentTypes['Employee'] = ResolversParentTypes['Employee'], FederationReferenceType extends FederationReferenceTypes['Employee'] = FederationReferenceTypes['Employee']> = ResolversObject<{
  __resolveReference?: ReferenceResolver<Maybe<ResolversTypes['Employee']> | FederationReferenceType, FederationReferenceType, ContextType>;
  createdAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  email?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  firstName?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  gender?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  grossSalary?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  lastName?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  salaryPerDay?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  supervisor?: Resolver<Maybe<ResolversTypes['Employee']>, ParentType, ContextType>;
  supervisorId?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  updatedAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
}>;

export type MutationResolvers<ContextType = EmployeeContextType, ParentType extends ResolversParentTypes['Mutation'] = ResolversParentTypes['Mutation']> = ResolversObject<{
  registerEmployee?: Resolver<ResolversTypes['RegisterEmployeeResult'], ParentType, ContextType, RequireFields<MutationRegisterEmployeeArgs, 'input'>>;
}>;

export type QueryResolvers<ContextType = EmployeeContextType, ParentType extends ResolversParentTypes['Query'] = ResolversParentTypes['Query']> = ResolversObject<{
  employees?: Resolver<Array<ResolversTypes['Employee']>, ParentType, ContextType>;
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

