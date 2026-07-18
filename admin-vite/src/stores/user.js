import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUserStore = defineStore('user', () => {
  const token = ref(localStorage.getItem('token') || '')
  
  const setToken = (newToken) => {
    token.value = newToken
    localStorage.setItem('token', newToken)
  }
  
  const logout = () => {
    token.value = ''
    localStorage.removeItem('token')
  }
  
  return {
    token,
    setToken,
    logout
  }
})
