<template>
  <el-container class="layout-container">
    <el-aside width="220px" class="aside">
      <div class="logo">
        <el-icon size="32"><Collection /></el-icon>
        <span>高洲罗氏族谱</span>
      </div>
      
      <el-menu
        :default-active="$route.path"
        router
        class="menu"
        background-color="#304156"
        text-color="#bfcbd9"
        active-text-color="#409EFF"
      >
        <el-menu-item index="/dashboard">
          <el-icon><DataLine /></el-icon>
          <span>数据概览</span>
        </el-menu-item>
        
        <el-menu-item index="/members">
          <el-icon><User /></el-icon>
          <span>族人管理</span>
        </el-menu-item>
        
        <el-menu-item index="/wives">
          <el-icon><UserFilled /></el-icon>
          <span>媳妇管理</span>
        </el-menu-item>
        
        <el-menu-item index="/sons-in-law">
          <el-icon><Avatar /></el-icon>
          <span>女婿管理</span>
        </el-menu-item>

        <el-sub-menu index="/ops">
          <template #title>
            <el-icon><Monitor /></el-icon>
            <span>运营管理</span>
          </template>
          <el-menu-item index="/accounts">
            <el-icon><Key /></el-icon>
            <span>登录账号</span>
          </el-menu-item>
          <el-menu-item index="/messages">
            <el-icon><ChatDotRound /></el-icon>
            <span>开发者留言</span>
          </el-menu-item>
        </el-sub-menu>
        
        <el-sub-menu index="/honor">
          <template #title>
            <el-icon><Trophy /></el-icon>
            <span>荣誉榜管理</span>
          </template>
          <el-menu-item index="/honor/patriarchs">
            <el-icon><Star /></el-icon>
            <span>族长表</span>
          </el-menu-item>
          <el-menu-item index="/honor/sages">
            <el-icon><Medal /></el-icon>
            <span>乡贤榜</span>
          </el-menu-item>
          <el-menu-item index="/honor/elite">
            <el-icon><UserFilled /></el-icon>
            <span>群英榜</span>
          </el-menu-item>
          <el-menu-item index="/honor/graduates">
            <el-icon><Reading /></el-icon>
            <span>学历榜</span>
          </el-menu-item>
        </el-sub-menu>

        <el-menu-item index="/fengtu">
          <el-icon><Notebook /></el-icon>
          <span>风土志</span>
        </el-menu-item>
      </el-menu>
    </el-aside>
    
    <el-container>
      <el-header class="header">
        <div class="breadcrumb">
          <el-breadcrumb>
            <el-breadcrumb-item :to="{ path: '/' }">首页</el-breadcrumb-item>
            <el-breadcrumb-item v-if="$route.meta.title">{{ $route.meta.title }}</el-breadcrumb-item>
          </el-breadcrumb>
        </div>
        <div class="user-info">
          <el-dropdown>
            <span class="user-name">
              管理员 <el-icon><ArrowDown /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item @click="logout">退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>
      
      <el-main class="main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/user.js'
import { Collection, DataLine, User, UserFilled, Avatar, Trophy, Star, Medal, Reading, ArrowDown, Monitor, Key, ChatDotRound, Notebook } from '@element-plus/icons-vue'

const router = useRouter()
const userStore = useUserStore()

const logout = () => {
  userStore.logout()
  router.push('/login')
}
</script>

<style scoped>
.layout-container {
  height: 100vh;
}

.aside {
  background-color: #304156;
}

.logo {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 18px;
  font-weight: bold;
  border-bottom: 1px solid #1f2d3d;
}

.logo .el-icon {
  margin-right: 10px;
}

.menu {
  border-right: none;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: #fff;
  box-shadow: 0 1px 4px rgba(0, 21, 41, 0.08);
}

.user-name {
  cursor: pointer;
  color: #606266;
}

.main {
  background-color: #f0f2f5;
  padding: 20px;
}
</style>
