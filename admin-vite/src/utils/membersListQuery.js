/** 族人列表页 URL 查询参数（用于详情/编辑返回时恢复筛选与分页） */
export const MEMBERS_LIST_QUERY_KEYS = ['branch', 'generation', 'name', 'page', 'pageSize']

export function pickMembersListQuery(query = {}) {
  const q = {}
  for (const key of MEMBERS_LIST_QUERY_KEYS) {
    const val = query[key]
    if (val != null && val !== '') q[key] = String(val)
  }
  return q
}

export function membersListRoute(query = {}) {
  return { path: '/members', query: pickMembersListQuery(query) }
}

export function membersEditRoute(id, listState = {}) {
  return {
    path: `/members/edit/${id}`,
    query: { ...pickMembersListQuery(listState), _from: 'members' }
  }
}

export function returnToMembersList(router, query = {}) {
  if (query._from === 'members') {
    router.push(membersListRoute(query))
  } else {
    router.push('/members')
  }
}
