import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getLatestProfessionalPosition,
  normalizeEducationHistory,
  normalizeProfessionalHistory,
} from './personHistory'

test('normalizeEducationHistory removes empty entries', () => {
  const history = normalizeEducationHistory([
    { institution: 'Dhaka College', degree: 'BSc', fieldOfStudy: 'Math', startYear: '2010', endYear: '2014', description: '' },
    { institution: '', degree: '', fieldOfStudy: '', startYear: '', endYear: '', description: '' },
  ])

  assert.equal(history.length, 1)
  assert.equal(history[0].institution, 'Dhaka College')
})

test('normalizeProfessionalHistory removes empty entries', () => {
  const history = normalizeProfessionalHistory([
    { company: 'Tech Co', position: 'Engineer', startYear: '2018', endYear: '2021', isCurrent: false, description: '' },
    { company: '', position: '', startYear: '', endYear: '', isCurrent: false, description: '' },
  ])

  assert.equal(history.length, 1)
  assert.equal(history[0].position, 'Engineer')
})

test('getLatestProfessionalPosition prefers current role', () => {
  const latest = getLatestProfessionalPosition([
    { company: 'Past Co', position: 'Analyst', startYear: '2019', endYear: '2022', isCurrent: false, description: '' },
    { company: 'Now Co', position: 'Manager', startYear: '2023', endYear: '', isCurrent: true, description: '' },
  ])

  assert.equal(latest?.position, 'Manager')
})

test('getLatestProfessionalPosition falls back to latest end year', () => {
  const latest = getLatestProfessionalPosition([
    { company: 'Company A', position: 'Developer', startYear: '2016', endYear: '2019', isCurrent: false, description: '' },
    { company: 'Company B', position: 'Lead Developer', startYear: '2020', endYear: '2024', isCurrent: false, description: '' },
  ])

  assert.equal(latest?.position, 'Lead Developer')
})

