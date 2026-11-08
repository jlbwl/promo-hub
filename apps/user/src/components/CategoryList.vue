<template>
  <div class="category-scroll">
    <div class="category-list">
      <div
        v-for="category in categories"
        :key="category.id"
        class="category-item"
        :class="{ active: activeCategory === category.id }"
        @click="selectCategory(category.id)"
      >
        <span class="category-name">{{ category.name }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 分类项接口
 */
interface Category {
  id: string
  name: string
  value: string
}

/**
 * 分类列表组件属性
 */
interface CategoryListProps {
  categories: Category[]
  activeCategory: string
}

/**
 * 分类列表组件事件
 */
interface Emits {
  (e: 'update:activeCategory', id: string): void
  (e: 'select', id: string): void
}

const { categories, activeCategory } = defineProps<CategoryListProps>()
const emit = defineEmits<Emits>()

/**
 * 选择分类
 */
const selectCategory = (categoryId: string) => {
  emit('update:activeCategory', categoryId)
  emit('select', categoryId)
}
</script>

<style scoped lang="scss">
.category-scroll {
  padding-top: 10px;
  background: transparent;
  border-bottom: none;
}

.category-list {
  display: flex;
  overflow-x: auto;
  padding: 0;
  -webkit-overflow-scrolling: touch;
  mask-image: linear-gradient(90deg, #000 0, #000 calc(100% - 20px), transparent 100%);

  &::-webkit-scrollbar {
    display: none;
  }
}

.category-item {
  position: relative;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  height: 29px;
  padding: 0 11px;
  margin-right: 6px;
  border: 1px solid var(--on-dark-line);
  border-radius: 8px;
  font-size: 11px;
  line-height: 1;
  white-space: nowrap;
  color: rgba(247, 235, 216, 0.7);
  background: rgba(255, 248, 236, 0.05);
  cursor: pointer;
  transition: all var(--duration) var(--ease);

  // 视觉高度 29px，通过伪元素把点击热区扩到约 44px
  &::after {
    content: '';
    position: absolute;
    inset: -7px -3px;
  }

  &.active {
    color: #3a2716;
    font-weight: 650;
    background: #d8b07a;
    border-color: #d8b07a;
  }
}
</style>
